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
st.caption("ZIP, PDF, DOCX, TXT, IPYNB 등 다양한 파일을 업로드하면 NVIDIA NIM API가 디테일을 살려 핵심을 정리해 드립니다.")

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
        # ipynb 파일 파싱 로직
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

# ==========================================
# 3. 텍스트 분할 및 NVIDIA API 요약 로직
# ==========================================
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

def call_nvidia_api(prompt: str, api_key: str, model_name: str) -> str:
    client = OpenAI(
        base_url="https://integrate.api.nvidia.com/v1",
        api_key=api_key
    )
    response = client.chat.completions.create(
        model=model_name,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2, 
        top_p=0.7,
        max_tokens=4000 
    )
    return response.choices[0].message.content

def summarize_text_with_chunks(full_text: str, api_key: str, model_name: str, max_chars: int) -> str:
    chunks = split_text(full_text, max_chars)
    
    if len(chunks) == 1:
        # 💡 프롬프트 수정 완료
        prompt = f"""다음 제공된 문서를 꼼꼼하게 분석하고 상세히 요약해 주세요.
단순히 길이를 줄이는 것이 목적이 아닙니다. 중요한 개념, 기술적 세부 사항, 데이터, 핵심 로직이 누락되지 않도록 주의하세요.
가독성을 위해 마크다운(헤딩, 불릿 포인트 등)을 적극적으로 활용하여 체계적으로 구조화해 주세요:

{chunks[0]}"""
        return call_nvidia_api(prompt, api_key, model_name)
    
    st.info(f"문서가 길어 총 {len(chunks)}개 부분으로 나누어 심층 분석을 진행합니다.")
    intermediate_summaries = []
    progress_bar = st.progress(0)
    
    for idx, chunk in enumerate(chunks):
        # 💡 오타(f-string 누락)가 있었던 곳! 확실하게 변수가 들어가도록 수정 완료
        prompt = f"""다음은 전체 문서의 일부({idx+1}/{len(chunks)})입니다.
이 부분에 포함된 중요한 세부 정보, 데이터, 로직, 핵심 맥락을 빠뜨리지 말고 상세히 기록해 주세요.
불필요하게 쳐내지 말고, 있는 정보를 최대한 구조화해서 정리하세요:

{chunk}"""
        
        max_retries = 3
        for attempt in range(max_retries):
            try:
                summary = call_nvidia_api(prompt, api_key, model_name)
                intermediate_summaries.append(f"[부분 {idx+1} 상세 정리]\n{summary}")
                break 
            except Exception as e:
                if attempt == max_retries - 1:
                    raise e 
                time.sleep(2) 
                
        progress_bar.progress((idx + 1) / len(chunks))
        time.sleep(1) 
        
    combined_summary_input = "\n\n".join(intermediate_summaries)
    
    # 💡 프롬프트 수정 완료
    final_prompt = f"""다음은 매우 긴 문서를 여러 부분으로 나누어 상세히 분석한 결과물들입니다.
이 정보들을 모두 종합하여, 전체 문서의 흐름과 디테일이 완벽하게 살아있는 최종 종합 보고서를 작성해 주세요.
분량에 구애받지 말고, 각 부분의 핵심적인 맥락과 중요 데이터가 절대로 누락되지 않도록 풍부하게 작성해야 합니다.
마크다운을 활용해 목차와 소제목을 나누어 전문적인 문서 형태로 출력해 주세요:

{combined_summary_input}"""
    
    return call_nvidia_api(final_prompt, api_key, model_name)

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
                combined_all_text = ""
                for fname, content in parsed_files.items():
                    combined_all_text += f"\n\n====================\n[파일명: {fname}]\n====================\n{content}"
                
                with st.spinner("NVIDIA AI가 문서의 디테일을 분석하며 종합 보고서를 작성 중입니다... (상세 분석 모드라 시간이 더 걸릴 수 있습니다)"):
                    try:
                        final_result = summarize_text_with_chunks(
                            combined_all_text, 
                            nvidia_api_key, 
                            selected_model, 
                            chunk_size
                        )
                        
                        st.subheader("📋 AI 상세 종합 요약 결과")
                        st.markdown(final_result)
                        
                        st.download_button(
                            label="요약 결과 다운로드 (.txt)",
                            data=final_result,
                            file_name="nvidia_detailed_summary.txt",
                            mime="text/plain"
                        )
                    except Exception as e:
                        st.error(f"요약 처리 중 오류가 발생했습니다: {str(e)}")
