import streamlit as st
import zipfile
import io
import os
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
st.caption("ZIP, PDF, DOCX, TXT 등 다양한 파일을 업로드하면 NVIDIA NIM API가 핵심을 정리해 드립니다.")

with st.sidebar:
    st.header("⚙️ API 및 모델 설정")
    # NVIDIA API Key 입력 (secrets 등록 또는 직접 입력)
    nvidia_api_key = st.text_input(
        "NVIDIA API Key",
        value=st.secrets.get("NVIDIA_API_KEY", ""),
        type="password",
        help="https://build.nvidia.com 에서 발급받은 nvapi- 로 시작하는 키를 입력하세요."
    )
    
    # NVIDIA 지원 모델 선택
    selected_model = st.selectbox(
        "사용할 AI 모델 선택",
        [
            "meta/llama-3.3-70b-instruct",
            "meta/llama-3.1-70b-instruct",
            "nvidia/llama-3.1-nemotron-70b-instruct",
            "mistralai/mixtral-8x22b-instruct"
        ]
    )
    
    chunk_size = st.slider("텍스트 분할 크기 (글자 수)", min_value=1000, max_value=8000, value=3000, step=500)

# ==========================================
# 2. 파일 파싱 헬퍼 함수들
# ==========================================
def extract_text_from_file(file_name: str, file_bytes: bytes) -> str:
    """단일 파일의 확장자를 판별하여 텍스트를 추출하는 함수"""
    ext = os.path.splitext(file_name)[1].lower()
    extracted_text = ""

    try:
        if ext in ['.txt', '.md', '.py', '.csv', '.json', '.log', '.html', '.xml', '.js', '.css']:
            # 텍스트 형식 파일
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

        else:
            # 지원하지 않는 기타 파일 포맷은 건너뜀
            return ""

    except Exception as e:
        return f"[파일 읽기 오류 ({file_name}): {str(e)}]"

    return extracted_text.strip()


def process_uploaded_file(uploaded_file) -> dict:
    """업로드된 파일(단일 또는 ZIP) 내의 모든 문서를 읽어 파일별 텍스트 딕셔너리로 반환"""
    file_contents = {}
    file_name = uploaded_file.name
    file_bytes = uploaded_file.read()

    # ZIP 파일 처리
    if file_name.lower().endswith('.zip'):
        with zipfile.ZipFile(io.BytesIO(file_bytes)) as z:
            for zip_info in z.infolist():
                if zip_info.is_dir():
                    continue
                inner_filename = zip_info.filename
                # 맥 시스템 파일이나 숨김 파일 제외
                if inner_filename.startswith('__MACOSX') or '/.' in inner_filename or inner_filename.startswith('.'):
                    continue
                
                with z.open(zip_info) as f:
                    content_bytes = f.read()
                    text = extract_text_from_file(inner_filename, content_bytes)
                    if text:
                        file_contents[inner_filename] = text
    else:
        # 단일 일반 파일 처리
        text = extract_text_from_file(file_name, file_bytes)
        if text:
            file_contents[file_name] = text

    return file_contents


# ==========================================
# 3. 텍스트 분할 및 NVIDIA API 요약 로직
# ==========================================
def split_text(text: str, max_chars: int) -> list[str]:
    """긴 텍스트를 청크 단위로 나누는 함수"""
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
    """OpenAI 라이브러리 호환 규격을 통해 NVIDIA NIM API 호출"""
    client = OpenAI(
        base_url="https://integrate.api.nvidia.com/v1",
        api_key=api_key
    )
    
    response = client.chat.completions.create(
        model=model_name,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
        top_p=0.7,
        max_tokens=1500
    )
    return response.choices[0].message.content


def summarize_text_with_chunks(full_text: str, api_key: str, model_name: str, max_chars: int) -> str:
    """Map-Reduce 방식을 활용한 단계별 요약"""
    chunks = split_text(full_text, max_chars)
    
    # 1개 청크일 경우 바로 요약
    if len(chunks) == 1:
        prompt = f"다음 문서를 읽고 핵심 내용을 체계적으로 요약해 주세요:\n\n{chunks[0]}"
        return call_nvidia_api(prompt, api_key, model_name)
    
    # 여러 청크일 경우: 각 청크 요약 -> 종합 요약 (Map-Reduce)
    st.info(f"문서가 길어 총 {len(chunks)}개 부분으로 나누어 분석을 진행합니다.")
    intermediate_summaries = []
    
    progress_bar = st.progress(0)
    for idx, chunk in enumerate(chunks):
        prompt = f"다음은 전체 문서의 일부입니다 ({idx+1}/{len(chunks)}). 핵심 내용을 축약하여 요약해 주세요:\n\n{chunk}"
        summary = call_nvidia_api(prompt, api_key, model_name)
        intermediate_summaries.append(f"[부분 {idx+1} 요약]\n{summary}")
        progress_bar.progress((idx + 1) / len(chunks))
        
    combined_summary_input = "\n\n".join(intermediate_summaries)
    final_prompt = (
        "다음은 전체 문서를 나누어 요약한 중간 결과들입니다. "
        "이 정보들을 종합하여 전체 문서의 구조화된 최종 요약 보고서를 작성해 주세요:\n\n"
        f"{combined_summary_input}"
    )
    
    return call_nvidia_api(final_prompt, api_key, model_name)


# ==========================================
# 4. 메인 UI 화면 구성
# ==========================================
uploaded_file = st.file_uploader(
    "파일을 선택하세요 (ZIP, PDF, DOCX, TXT, MD, CSV 등)", 
    type=["zip", "pdf", "docx", "txt", "md", "csv", "json", "py"]
)

if uploaded_file is not None:
    with st.spinner("파일 구조 해석 및 텍스트 추출 중..."):
        parsed_files = process_uploaded_file(uploaded_file)
        
    if not parsed_files:
        st.error("파일에서 읽을 수 있는 텍스트를 찾지 못했습니다.")
    else:
        st.success(f"총 {len(parsed_files)}개의 문서 텍스트를 성공적으로 가져왔습니다!")
        
        # 파일별 원본 미리보기 탭
        with st.expander("📄 추출된 원본 파일 목록 및 내용 확인"):
            tabs = st.tabs(list(parsed_files.keys()))
            for idx, (fname, fcontent) in enumerate(parsed_files.items()):
                with tabs[idx]:
                    st.text_area(f"{fname} 미리보기", value=fcontent[:2000] + ("..." if len(fcontent) > 2000 else ""), height=200)

        # 요약 시작 버튼
        if st.button("🚀 NVIDIA AI 전체 요약 시작", type="primary"):
            if not nvidia_api_key:
                st.error("사이드바에서 NVIDIA API Key를 먼저 입력해 주세요!")
            else:
                # 추출된 모든 파일을 하나로 합쳐서 요약 요청 준비
                combined_all_text = ""
                for fname, content in parsed_files.items():
                    combined_all_text += f"\n\n====================\n[파일명: {fname}]\n====================\n{content}"
                
                with st.spinner("NVIDIA AI가 문서 내용을 분석 및 요약하고 있습니다..."):
                    try:
                        final_result = summarize_text_with_chunks(
                            combined_all_text, 
                            nvidia_api_key, 
                            selected_model, 
                            chunk_size
                        )
                        
                        st.subheader("📋 AI 최종 요약 결과")
                        st.markdown(final_result)
                        
                        # 요약 결과 다운로드 버튼 제공
                        st.download_button(
                            label="요약 결과 다운로드 (.txt)",
                            data=final_result,
                            file_name="nvidia_summary_result.txt",
                            mime="text/plain"
                        )
                    except Exception as e:
                        st.error(f"요약 처리 중 오류가 발생했습니다: {str(e)}")
