import streamlit as st
import zipfile
import io
import os
import time
import json
from openai import OpenAI

# PDF 및 DOCX 파싱 라이브러리 예외 처리
try:
    import pypdf
except ImportError:
    pypdf = None

try:
    import docx
except ImportError:
    docx = None

# ==========================================
# 1. 페이지 및 사이드바 설정
# ==========================================
st.set_page_config(page_title="NVIDIA AI 통합 문서 요약기", page_icon="📚", layout="wide")
st.title("📚 NVIDIA AI 멀티 파일 요약 서비스")
st.caption("ZIP, PDF, DOCX, TXT, IPYNB 등 다양한 파일을 업로드하면 NVIDIA AI가 디테일을 살려 핵심을 정리해 드립니다.")

with st.sidebar:
    st.header("⚙️ API 및 모델 설정")
    nvidia_api_key = st.text_input(
        "NVIDIA API Key",
        value=st.secrets.get("NVIDIA_API_KEY", ""),
        type="password"
    )
    
    model_choice = st.selectbox(
        "사용할 AI 모델 선택",
        [
            "z-ai/glm-5.2",
            "deepseek-ai/deepseek-v4-pro",
            "deepseek-ai/deepseek-v4-flash",
            "nvidia/nemotron-3-ultra-550b-a55b",
            "mistralai/mistral-medium-3.5-128b",
            "meta/llama-3.1-8b-instruct",
            "직접 입력하기 (NVIDIA 사이트 복사)"
        ]
    )
    
    if model_choice == "직접 입력하기 (NVIDIA 사이트 복사)":
        selected_model = st.text_input(
            "NVIDIA 홈페이지의 예제 코드에 있는 모델명을 그대로 붙여넣으세요:", 
            value="z-ai/glm-5.2"
        )
    else:
        selected_model = model_choice
        
    chunk_size = st.slider("텍스트 분할 크기 (글자 수)", min_value=2000, max_value=10000, value=4000, step=1000)

# ==========================================
# 2. 파일 파싱 헬퍼 함수들
# ==========================================
def extract_text_from_file(file_name: str, file_bytes: bytes) -> str:
    ext = os.path.splitext(file_name)[1].lower()
    extracted_text = ""
    try:
        if ext == '.ipynb':
            notebook = json.loads(file_bytes.decode('utf-8'))
            for cell in notebook.get('cells', []):
                if cell.get('cell_type') in ['markdown', 'code']:
                    source = cell.get('source', [])
                    if isinstance(source, list):
                        extracted_text += "".join(source) + "\n\n"
                    else:
                        extracted_text += source + "\n\n"
        elif ext in ['.txt', '.md', '.py', '.csv', '.json', '.log', '.html', '.xml', '.js', '.css']:
            extracted_text = file_bytes.decode('utf-8', errors='ignore')
        elif ext == '.pdf':
            if pypdf is None:
                return "[오류: pypdf 라이브러리가 설치되지 않았습니다.]"
            pdf_reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            for page in pdf_reader.pages:
                text = page.extract_text()
                if text:
                    extracted_text += text + "\n"
        elif ext in ['.docx', '.doc']:
            if docx is None:
                return "[오류: python-docx 라이브러리가 설치되지 않았습니다.]"
            doc = docx.Document(io.BytesIO(file_bytes))
            extracted_text = "\n".join([para.text for para in doc.paragraphs if para.text.strip()])
    except Exception as e:
        return f"[파일 읽기 오류 ({file_name}): {str(e)}]"
    return extracted_text.strip()

def process_uploaded_file(uploaded_file) -> dict:
    file_contents = {}
    file_name = uploaded_file.name
    file_bytes = uploaded_file.read()

    if file_name.lower().endswith('.zip'):
        with zipfile.ZipFile(io.BytesIO(file_bytes)) as z:
            for zip_info in z.infolist():
                if zip_info.is_dir():
                    continue
                inner_filename = zip_info.filename
                if inner_filename.startswith('__MACOSX') or '/.' in inner_filename or inner_filename.startswith('.'):
                    continue
                with z.open(zip_info) as f:
                    text = extract_text_from_file(inner_filename, f.read())
                    if text:
                        file_contents[inner_filename] = text
    else:
        text = extract_text_from_file(file_name, file_bytes)
        if text:
            file_contents[file_name] = text
    return file_contents

def split_text(text: str, max_chars: int) -> list[str]:
    paragraphs = text.split("\n")
    chunks = []
    current_chunk = ""
    for paragraph in paragraphs:
        if len(current_chunk) + len(paragraph) < max_chars:
            current_chunk += paragraph + "\n"
        else:
            if current_chunk.strip():
                chunks.append(current_chunk.strip())
            current_chunk = paragraph + "\n"
    if current_chunk.strip():
        chunks.append(current_chunk.strip())
    return chunks

# ==========================================
# 3. NVIDIA API 통신 로직 (무한 반복 방지 및 에러 방어)
# ==========================================
def call_nvidia_api(prompt: str, api_key: str, model_name: str) -> str:
    """중간 청크 요약을 위한 API 호출 (비스트리밍)"""
    client = OpenAI(base_url="https://integrate.api.nvidia.com/v1", api_key=api_key)
    response = client.chat.completions.create(
        model=model_name,
        messages=[
            {"role": "system", "content": "당신은 냉철하고 객관적인 전문 문서 분석가입니다. 중복된 내용을 반복해서 출력하지 말고, 명확하고 구조화된 형태로 핵심만 요약하세요."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.4,       # 루프에 빠지지 않도록 유연성 약간 부여
        frequency_penalty=0.6, # 💡 같은 단어/문장 무한 반복 강제 억제
        top_p=0.7,
        max_tokens=4000 
    )
    
    # 💡 방어 코드: 비어있는 응답으로 인한 list index out of range 에러 차단
    if not response.choices:
        return "[오류: 서버에서 유효한 응답을 반환하지 않았습니다. 해당 청크는 건너뜁니다.]"
        
    return response.choices[0].message.content

def stream_nvidia_api(prompt: str, api_key: str, model_name: str):
    """최종 종합 보고서를 실시간으로 타자 치듯 보여주는 제너레이터"""
    client = OpenAI(base_url="https://integrate.api.nvidia.com/v1", api_key=api_key)
    response = client.chat.completions.create(
        model=model_name,
        messages=[
            {"role": "system", "content": "당신은 냉철하고 객관적인 전문 문서 분석가입니다. 중복된 내용을 반복해서 출력하지 말고, 명확하고 구조화된 형태로 핵심만 요약하세요. 문장이 중간에 끊기지 않도록 완결성 있게 끝맺어야 합니다."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.4,
        frequency_penalty=0.6,
        top_p=0.7,
        max_tokens=4000,
        stream=True 
    )
    
    for chunk in response:
        # 💡 방어 코드: 스트리밍 중 비어있는 패킷이 날아와도 앱이 터지지 않도록 보호
        if chunk.choices and len(chunk.choices) > 0:
            delta = chunk.choices[0].delta
            if delta and delta.content is not None:
                yield delta.content

# ==========================================
# 4. 메인 UI 화면 구성
# ==========================================
uploaded_file = st.file_uploader(
    "파일을 선택하세요 (ZIP, PDF, DOCX, TXT, IPYNB, CSV 등)", 
    type=["zip", "pdf", "docx", "txt", "md", "csv", "json", "py", "ipynb"]
)

if uploaded_file is not None:
    with st.spinner("파일 구조 해석 및 텍스트 추출 중..."):
        parsed_files = process_uploaded_file(uploaded_file)
        
    if not parsed_files:
        st.error("파일에서 읽을 수 있는 텍스트를 찾지 못했습니다.")
    else:
        st.success(f"총 {len(parsed_files)}개의 문서 텍스트를 성공적으로 가져왔습니다!")
        
        with st.expander("📄 추출된 원본 파일 목록 및 내용 확인"):
            tabs = st.tabs(list(parsed_files.keys())[:10] + (["...나머지 파일들"] if len(parsed_files) > 10 else []))
            for idx, (fname, fcontent) in enumerate(list(parsed_files.items())[:10]):
                with tabs[idx]:
                    st.text_area(f"{fname} 미리보기", value=fcontent[:2000] + ("..." if len(fcontent) > 2000 else ""), height=200)

        if st.button("🚀 NVIDIA AI 전체 상세 요약 시작", type="primary"):
            if not nvidia_api_key:
                st.error("사이드바에서 NVIDIA API Key를 먼저 입력해 주세요!")
            else:
                # 추출된 파일 텍스트를 하나로 결합
                combined_all_text = ""
                for fname, content in parsed_files.items():
                    combined_all_text += f"\n\n====================\n[파일명: {fname}]\n====================\n{content}"
                
                # 지정된 글자 수 단위로 분할
                chunks = split_text(combined_all_text, chunk_size)
                
                # 1) 단일 청크일 경우: 바로 실시간 스트리밍 출력
                if len(chunks) == 1:
                    final_prompt = f"""다음 제공된 문서를 꼼꼼하게 분석하고 상세히 요약해 주세요.
중요한 개념, 기술적 세부 사항, 데이터, 핵심 로직이 누락되지 않도록 주의하세요.
글이 중간에 잘리지 않도록 분량을 적절히 조절하여 반드시 '결론' 부분까지 완성해 주세요:

{chunks[0]}"""
                    
                    st.subheader("📋 AI 상세 종합 요약 결과")
                    try:
                        final_result = st.write_stream(stream_nvidia_api(final_prompt, nvidia_api_key, selected_model))
                        st.download_button("요약 결과 다운로드 (.txt)", final_result, "nvidia_detailed_summary.txt", "text/plain")
                    except Exception as e:
                        st.error(f"요약 처리 중 통신 오류가 발생했습니다: {str(e)}")
                        
                # 2) 여러 청크일 경우: Map-Reduce 방식 적용
                else:
                    st.info(f"문서가 길어 총 {len(chunks)}개 부분으로 나누어 심층 분석을 진행합니다. (진행 상황이 아래에 실시간으로 표시됩니다)")
                    intermediate_summaries = []
                    progress_bar = st.progress(0)
                    
                    status_container = st.empty()
                    expander = st.expander("⏳ 부분별 세부 분석 내역 확인 (클릭해서 펼치기)")
                    
                    try:
                        # 2-A) 중간 요약 진행 (Map 단계)
                        for idx, chunk in enumerate(chunks):
                            status_container.info(f"🔄 부분 {idx+1}/{len(chunks)} 기초 분석 중...")
                            
                            prompt = f"""다음은 전체 문서의 일부({idx+1}/{len(chunks)})입니다.
이 부분에 포함된 중요한 세부 정보, 데이터, 로직, 핵심 맥락을 빠뜨리지 말고 상세히 기록해 주세요.
내용을 억지로 생략하지 말고, 마크다운을 활용해 있는 정보를 최대한 구조화해서 정리하세요:

{chunk}"""
                            
                            max_retries = 3
                            for attempt in range(max_retries):
                                try:
                                    summary = call_nvidia_api(prompt, nvidia_api_key, selected_model)
                                    intermediate_summaries.append(f"### [부분 {idx+1} 핵심 정리]\n{summary}")
                                    expander.markdown(f"**✅ 부분 {idx+1} 처리 완료**")
                                    break 
                                except Exception as e:
                                    if attempt == max_retries - 1:
                                        st.error(f"부분 {idx+1} 처리 중 오류가 지속 발생하여 건너뜁니다: {str(e)}")
                                    time.sleep(2) 
                                    
                            progress_bar.progress((idx + 1) / len(chunks))
                            time.sleep(1) # 연속 호출에 의한 서버 차단(Rate Limit) 방지
                            
                        status_container.success("✅ 모든 부분의 기초 분석이 완료되었습니다. 최종 보고서를 실시간으로 작성합니다!")
                        
                        # 2-B) 최종 종합 요약 (Reduce 단계)
                        combined_summary_input = "\n\n".join(intermediate_summaries)
                        
                        final_prompt = f"""다음은 방대한 문서를 여러 부분으로 나누어 상세히 분석한 중간 결과물들입니다.
이 정보들을 모두 종합하여, 전체 문서의 흐름과 디테일이 완벽하게 살아있는 최종 종합 보고서를 작성해 주세요.
마크다운을 활용해 목차와 소제목을 명확하게 나누어 전문적인 보고서 형태로 출력해 주세요.
주의사항: 글이 중간에 절대 끊기지 않도록 내용의 완급을 조절하며, 반드시 전체 내용에 대한 '결론'을 맺어주세요.

{combined_summary_input}"""
                        
                        st.divider()
                        st.subheader("📋 AI 상세 종합 요약 결과")
                        
                        # 최종 결과를 눈으로 바로 볼 수 있도록 스트리밍 처리
                        final_result = st.write_stream(stream_nvidia_api(final_prompt, nvidia_api_key, selected_model))
                        
                        # 다 써진 결과물을 다운로드할 수 있도록 버튼 제공
                        st.download_button(
                            label="요약 결과 다운로드 (.txt)",
                            data=final_result,
                            file_name="nvidia_detailed_summary.txt",
                            mime="text/plain"
                        )
                        
                    except Exception as e:
                        st.error(f"요약 처리 중 통신 오류가 발생했습니다: {str(e)}")
