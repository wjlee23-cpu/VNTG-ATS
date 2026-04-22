'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/api/utils/auth';

/**
 * Gemini AI를 사용하여 후보자와 JD의 매칭 점수를 분석합니다.
 * @param candidateId 후보자 ID
 * @param jobPostId 채용 공고 ID
 * @returns 분석 결과 (score, summary, strengths, weaknesses)
 */
export async function analyzeCandidateMatch(
  candidateId: string,
  jobPostId: string
): Promise<{
  score: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  interviewQuestions: { question: string; intent: string }[];
}> {
  try {
    console.log(`[analyzeCandidateMatch] ===== AI 분석 시작 =====`);
    console.log(`[analyzeCandidateMatch] 후보자 ID: ${candidateId}`);
    console.log(`[analyzeCandidateMatch] 채용 공고 ID: ${jobPostId}`);

    // 환경변수 확인
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey || apiKey.length < 20) {
      console.error('[analyzeCandidateMatch] GOOGLE_GEMINI_API_KEY가 설정되지 않음');
      throw new Error('GOOGLE_GEMINI_API_KEY가 설정되지 않았거나 유효하지 않습니다.');
    }
    console.log('[analyzeCandidateMatch] API 키 확인 완료');

    // Supabase 클라이언트 생성 (Service Client 사용하여 RLS 우회)
    const supabase = createServiceClient();

    // 1. 후보자 데이터 조회 (파일이 조회될 때까지 최대 3번 재시도)
    let candidate: any = null;
    let candidateError: any = null;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      const result = await supabase
        .from('candidates')
        .select(`
          id,
          name,
          email,
          skills,
          experience,
          education,
          parsed_data,
          resume_files (
            id,
            file_url,
            file_type,
            parsing_status,
            parsed_data
          )
        `)
        .eq('id', candidateId)
        .single();
      
      candidate = result.data;
      candidateError = result.error;
      
      // 파일이 조회되었거나 에러가 발생하면 종료
      if (candidate && candidate.resume_files && candidate.resume_files.length > 0) {
        console.log(`[analyzeCandidateMatch] 파일 조회 성공 (시도 ${retryCount + 1}/${maxRetries}): ${candidate.resume_files.length}개 파일`);
        break;
      }
      
      if (candidateError) {
        console.error(`[analyzeCandidateMatch] 후보자 데이터 조회 실패 (시도 ${retryCount + 1}/${maxRetries}):`, candidateError);
        break;
      }
      
      // 파일이 없으면 재시도
      if (retryCount < maxRetries - 1) {
        console.log(`[analyzeCandidateMatch] 파일이 아직 조회되지 않음, ${1000 * (retryCount + 1)}ms 후 재시도...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // 1초, 2초, 3초 지연
      }
      
      retryCount++;
    }

    if (candidateError || !candidate) {
      throw new Error(`후보자 데이터 조회 실패: ${candidateError?.message || '후보자를 찾을 수 없습니다.'}`);
    }

    // 2. 채용 공고(JD) 데이터 조회
    const { data: jobPost, error: jobPostError } = await supabase
      .from('job_posts')
      .select('id, title, description')
      .eq('id', jobPostId)
      .single();

    if (jobPostError || !jobPost) {
      throw new Error(`채용 공고 데이터 조회 실패: ${jobPostError?.message || '채용 공고를 찾을 수 없습니다.'}`);
    }

    // 3. 이력서 파일이 있는지 확인
    const resumeFiles = candidate.resume_files as Array<{
      id: string;
      file_url: string;
      file_type: string;
      parsing_status: string;
      parsed_data?: any;
    }> | null;

    const hasResumeFile = resumeFiles && resumeFiles.length > 0;

    // 파일이 없으면 분석을 시작하지 않음 (에러를 throw하지 않고 상태만 업데이트)
    if (!hasResumeFile) {
      console.warn('[analyzeCandidateMatch] 이력서 파일이 없어 분석을 건너뜁니다. 후보자 ID:', candidateId);
      await supabase
        .from('candidates')
        .update({ 
          ai_analysis_status: 'failed',
          ai_summary: '이력서 파일이 없어 AI 분석을 수행할 수 없습니다.',
        })
        .eq('id', candidateId);
      // 에러를 throw하지 않고 빈 결과 반환 (호출자가 계속 진행할 수 있도록)
      return {
        score: 0,
        summary: '이력서 파일이 없어 AI 분석을 수행할 수 없습니다.',
        strengths: [],
        weaknesses: [],
        // 인터뷰 질문 목록은 타입상 필수이므로, 이력서가 없을 때는 빈 배열로 반환합니다.
        interviewQuestions: [],
      };
    }

    // 4. 분석 상태를 'processing'으로 업데이트
    await supabase
      .from('candidates')
      .update({ ai_analysis_status: 'processing' })
      .eq('id', candidateId);

    // 5. 후보자 정보 수집
    const candidateInfo = {
      name: candidate.name,
      email: candidate.email,
      skills: candidate.skills || [],
      experience: candidate.experience || '',
      education: candidate.education || '',
      parsedData: candidate.parsed_data || {},
    };

    // parsed_data에서 추가 정보 추출
    const parsedSkills = candidateInfo.parsedData?.skills || [];
    const parsedExperience = candidateInfo.parsedData?.experience || '';
    const parsedEducation = candidateInfo.parsedData?.education || '';

    // 스킬 통합 (중복 제거)
    const allSkills = [
      ...(candidateInfo.skills || []),
      ...(Array.isArray(parsedSkills) ? parsedSkills : []),
    ].filter((skill, index, self) => self.indexOf(skill) === index);

    // 경력 및 학력 정보 통합
    const experienceText = candidateInfo.experience || parsedExperience || '정보 없음';
    const educationText = candidateInfo.education || parsedEducation || '정보 없음';

    // 6. 파일 다운로드 및 Gemini File API에 업로드
    const fileParts: Array<{ inlineData: { data: string; mimeType: string } }> = [];
    
    if (hasResumeFile && resumeFiles) {
      console.log(`[analyzeCandidateMatch] ${resumeFiles.length}개 파일 다운로드 및 분석 시작...`);
      
      for (const resumeFile of resumeFiles) {
        try {
          console.log(`[analyzeCandidateMatch] 파일 처리 시작: ${resumeFile.id}, URL: ${resumeFile.file_url}`);
          
          // Supabase Storage에서 파일 다운로드
          // file_url에서 파일 경로 추출
          // URL 형식: https://xxx.supabase.co/storage/v1/object/public/resumes/candidate-id/timestamp-filename.pdf
          // 또는: https://xxx.supabase.co/storage/v1/object/sign/resumes/...?token=...
          let storagePath: string | null = null;
          
          // '/resumes/' 이후의 경로 추출
          const resumesIndex = resumeFile.file_url.indexOf('/resumes/');
          if (resumesIndex !== -1) {
            storagePath = resumeFile.file_url.substring(resumesIndex + '/resumes/'.length);
            // 쿼리 파라미터 제거 (signed URL의 경우)
            const queryIndex = storagePath.indexOf('?');
            if (queryIndex !== -1) {
              storagePath = storagePath.substring(0, queryIndex);
            }
          }
          
          if (!storagePath) {
            console.warn(`[analyzeCandidateMatch] 파일 경로 추출 실패: ${resumeFile.file_url}`);
            continue;
          }

          console.log(`[analyzeCandidateMatch] 파일 다운로드 시작: ${storagePath}`);
          // 파일 다운로드
          const { data: fileData, error: downloadError } = await supabase.storage
            .from('resumes')
            .download(storagePath);

          if (downloadError || !fileData) {
            console.error(`[analyzeCandidateMatch] 파일 다운로드 실패 (${resumeFile.id}):`, downloadError?.message || '파일 데이터 없음');
            continue;
          }

          console.log(`[analyzeCandidateMatch] 파일 다운로드 성공, Base64 인코딩 시작...`);
          // 파일을 ArrayBuffer로 변환 후 Base64로 인코딩
          const arrayBuffer = await fileData.arrayBuffer();
          const base64Data = Buffer.from(arrayBuffer).toString('base64');
          console.log(`[analyzeCandidateMatch] Base64 인코딩 완료, 크기: ${Math.round(base64Data.length / 1024)}KB`);

          // MIME 타입 결정
          let mimeType = 'application/pdf';
          if (resumeFile.file_type === 'doc') {
            mimeType = 'application/msword';
          } else if (resumeFile.file_type === 'docx') {
            mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          }

          // Gemini File API 형식으로 추가
          fileParts.push({
            inlineData: {
              data: base64Data,
              mimeType: mimeType,
            },
          });

          console.log(`[analyzeCandidateMatch] 파일 분석 준비 완료: ${resumeFile.file_type} (${Math.round(arrayBuffer.byteLength / 1024)}KB)`);
        } catch (fileError) {
          console.error(`[analyzeCandidateMatch] 파일 처리 중 오류 (${resumeFile.id}):`, fileError);
          console.error(`[analyzeCandidateMatch] 에러 스택:`, fileError instanceof Error ? fileError.stack : '스택 정보 없음');
          // 개별 파일 오류는 무시하고 계속 진행
        }
      }
      
      console.log(`[analyzeCandidateMatch] 총 ${fileParts.length}개 파일이 분석 준비되었습니다.`);
    }

    // 7. Gemini API 호출
    // gemini-2.5-flash 모델 사용
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: {
        // gemini-2.5 SDK 타입 정의 기준: camelCase 속성 사용
        responseMimeType: 'application/json',
        temperature: 0.7,
        topP: 0.95,
        topK: 40,
      },
    });

    // 프롬프트 구성
    const fileInfoText = fileParts.length > 0 
      ? `**첨부 파일**: ${fileParts.length}개 파일이 첨부되어 있습니다. (이력서, 포트폴리오, 연구논문 등)`
      : '**이력서 파일**: 없음';

    const prompt = `당신은 채용 전문가입니다. 주어진 채용 공고(JD)와 지원자 이력서 정보를 비교 분석하여, 지원자의 적합도를 0~100점 사이로 평가하고 상세한 인사이트를 제공해주세요.

## 채용 공고 (Job Description)
**포지션**: ${jobPost.title}
**상세 설명**:
${jobPost.description || '상세 설명이 제공되지 않았습니다.'}

## 지원자 정보
**이름**: ${candidateInfo.name}
**이메일**: ${candidateInfo.email}
**보유 스킬**: ${allSkills.length > 0 ? allSkills.join(', ') : '정보 없음'}
**경력**: ${experienceText}
**학력**: ${educationText}
${fileInfoText}

${fileParts.length > 0 ? `
## 첨부 파일 분석
아래 첨부된 파일들을 모두 분석하여 종합적인 평가를 해주세요. 파일에는 이력서, 포트폴리오, 연구논문 등이 포함될 수 있습니다.
모든 파일의 내용을 종합하여 지원자의 전체적인 역량을 평가해주세요.
` : ''}

## 분석 요청사항
다음 JSON 형식으로 응답해주세요:
{
  "score": 0-100 사이의 정수 (JD와의 적합도 점수),
  "totalExperienceMonths": 0 이상의 정수 (지원자의 총 경력 개월 수, 신입이면 0),
  "summary": "2-3줄로 요약한 지원자 적합도 평가 (한국어, 자연스러운 문체)",
  "strengths": ["강점 1", "강점 2", "강점 3"] (최대 5개, 한국어),
  "weaknesses": ["보완점 1", "보완점 2"] (최대 5개, 한국어),
  "interviewQuestions": [
    { "question": "면접에서 물어볼 구체적인 질문 (한국어)", "intent": "이 질문으로 검증하려는 역량/갭 (한국어)" }
  ] (최대 5개, JD·이력서 갭을 검증하는 실무형 질문)
}

## 평가 기준
1. **기술 스킬 매칭도**: JD에서 요구하는 기술 스택과 지원자의 보유 스킬 일치도
2. **경력 적합성**: 지원자의 경력이 JD 요구사항과 얼마나 부합하는지
3. **학력 및 자격**: 학력, 자격증 등이 포지션에 적합한지
4. **전체적인 적합도**: 종합적인 평가
${fileParts.length > 0 ? '5. **첨부 파일 분석**: 이력서, 포트폴리오, 연구논문 등 첨부된 모든 파일의 내용을 종합하여 평가' : ''}

점수는 엄격하게 평가하되, 공정하고 객관적으로 평가해주세요. 80점 이상은 매우 우수한 적합도, 60-79점은 양호한 적합도, 40-59점은 보통, 40점 미만은 낮은 적합도로 판단합니다.

반드시 유효한 JSON 형식으로만 응답해주세요. 다른 설명이나 마크다운 없이 순수 JSON만 반환해주세요.`;

    console.log('[analyzeCandidateMatch] Gemini API 호출 중...');
    console.log(`[analyzeCandidateMatch] 프롬프트 길이: ${prompt.length}자, 파일 개수: ${fileParts.length}개`);
    
    // 파일이 있으면 파일과 함께, 없으면 텍스트만 전달
    let result;
    try {
      if (fileParts.length > 0) {
        console.log('[analyzeCandidateMatch] 파일과 함께 Gemini API 호출...');
        result = await model.generateContent([prompt, ...fileParts]);
      } else {
        console.log('[analyzeCandidateMatch] 텍스트만으로 Gemini API 호출...');
        result = await model.generateContent(prompt);
      }
      console.log('[analyzeCandidateMatch] Gemini API 호출 성공');
    } catch (apiError) {
      console.error('[analyzeCandidateMatch] Gemini API 호출 실패:', apiError);
      console.error('[analyzeCandidateMatch] 에러 스택:', apiError instanceof Error ? apiError.stack : '스택 정보 없음');
      throw apiError;
    }
    const response = result.response;
    const text = response.text().trim();

    console.log('[analyzeCandidateMatch] Gemini API 응답 수신:', text.substring(0, 200) + '...');

    // 7. JSON 파싱
    let analysisResult: {
      score: number;
      totalExperienceMonths?: number;
      total_experience_months?: number;
      summary: string;
      strengths: string[];
      weaknesses: string[];
      interviewQuestions?: unknown;
      interview_questions?: unknown;
    };

    try {
      // JSON 코드 블록 제거 (```json ... ``` 형식일 수 있음)
      const cleanedText = text
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .trim();
      
      analysisResult = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('[analyzeCandidateMatch] JSON 파싱 실패:', parseError);
      console.error('[analyzeCandidateMatch] 원본 응답:', text);
      throw new Error(`AI 응답 파싱 실패: ${parseError instanceof Error ? parseError.message : '알 수 없는 오류'}`);
    }

    // 8. 응답 검증
    if (typeof analysisResult.score !== 'number' || analysisResult.score < 0 || analysisResult.score > 100) {
      throw new Error(`유효하지 않은 점수: ${analysisResult.score}`);
    }

    if (!analysisResult.summary || typeof analysisResult.summary !== 'string') {
      throw new Error('summary 필드가 유효하지 않습니다.');
    }

    if (!Array.isArray(analysisResult.strengths) || !Array.isArray(analysisResult.weaknesses)) {
      throw new Error('strengths 또는 weaknesses가 배열이 아닙니다.');
    }

    const rawInterviewQs =
      analysisResult.interviewQuestions ?? analysisResult.interview_questions;
    const interviewQuestionsNormalized: { question: string; intent: string }[] = [];
    if (Array.isArray(rawInterviewQs)) {
      for (const item of rawInterviewQs.slice(0, 5)) {
        if (!item || typeof item !== 'object') continue;
        const o = item as Record<string, unknown>;
        const q = o.question;
        if (typeof q !== 'string' || !q.trim()) continue;
        const intent = typeof o.intent === 'string' && o.intent.trim() ? o.intent.trim() : '';
        interviewQuestionsNormalized.push({ question: q.trim(), intent });
      }
    }

    // 점수를 정수로 변환
    const score = Math.round(Math.max(0, Math.min(100, analysisResult.score)));

    // 총 경력(개월) 정규화: 없는 경우 null로 저장하지 않고 생략
    const rawTotalMonths =
      analysisResult.totalExperienceMonths ?? analysisResult.total_experience_months;
    const totalExperienceMonths =
      typeof rawTotalMonths === 'number' && Number.isFinite(rawTotalMonths) && rawTotalMonths >= 0
        ? Math.floor(rawTotalMonths)
        : null;

    // 9. DB에 결과 저장
    const { error: updateError } = await supabase
      .from('candidates')
      .update({
        ai_score: score,
        ai_summary: analysisResult.summary,
        ai_strengths: analysisResult.strengths.slice(0, 5), // 최대 5개
        ai_weaknesses: analysisResult.weaknesses.slice(0, 5), // 최대 5개
        ai_interview_questions: interviewQuestionsNormalized,
        ai_analysis_status: 'completed',
        ...(totalExperienceMonths !== null
          ? { total_experience_months: totalExperienceMonths }
          : {}),
      })
      .eq('id', candidateId);

    if (updateError) {
      console.error('[analyzeCandidateMatch] DB 업데이트 실패:', updateError);
      
      // AI 관련 컬럼이 없는 경우 마이그레이션 안내
      if (updateError.code === 'PGRST204' || 
          updateError.message?.includes('ai_summary') ||
          updateError.message?.includes('ai_score') ||
          updateError.message?.includes('ai_strengths') ||
          updateError.message?.includes('ai_weaknesses') ||
          updateError.message?.includes('ai_analysis_status') ||
          updateError.message?.includes('ai_interview_questions')) {
        
        // 누락된 컬럼 추출 (에러 메시지에서)
        const missingColumns: string[] = [];
        const errorMsg = updateError.message || '';
        
        if (errorMsg.includes('ai_summary')) missingColumns.push('ai_summary');
        if (errorMsg.includes('ai_score')) missingColumns.push('ai_score');
        if (errorMsg.includes('ai_strengths')) missingColumns.push('ai_strengths');
        if (errorMsg.includes('ai_weaknesses')) missingColumns.push('ai_weaknesses');
        if (errorMsg.includes('ai_analysis_status')) missingColumns.push('ai_analysis_status');
        if (errorMsg.includes('ai_interview_questions')) missingColumns.push('ai_interview_questions');
        
        // PGRST204 에러지만 구체적인 컬럼명이 없으면 모든 AI 필드가 누락된 것으로 간주
        if (updateError.code === 'PGRST204' && missingColumns.length === 0) {
          missingColumns.push(
            'ai_summary',
            'ai_score',
            'ai_strengths',
            'ai_weaknesses',
            'ai_analysis_status',
            'ai_interview_questions',
          );
        }
        
        console.error('\n⚠️  [analyzeCandidateMatch] AI 분석 관련 컬럼을 찾을 수 없습니다.');
        if (missingColumns.length > 0) {
          console.error(`📋 누락된 컬럼: ${missingColumns.join(', ')}`);
        }
        console.error('📋 다음 마이그레이션을 실행해주세요:');
        console.error('   supabase/migrations/20260307000000_add_ai_match_fields.sql');
        console.error('   supabase/migrations/20260323120000_add_ai_interview_questions.sql');
        console.error('\n💡 실행 방법:');
        console.error('   1. Supabase 대시보드 > SQL Editor에서 마이그레이션 파일 내용 실행');
        console.error('   2. 또는: npx supabase db push');
        console.error('   3. 실행 후: Settings > API > Refresh Schema Cache');
        console.error('      (중요: 스키마 캐시를 갱신하지 않으면 계속 오류가 발생합니다)\n');
      }
      
      throw new Error(`분석 결과 저장 실패: ${updateError.message}`);
    }

    // 10. 타임라인 이벤트 생성 (실패해도 분석 결과는 반환)
    try {
      const user = await getCurrentUser();
      const { data: timelineData, error: timelineError } = await supabase
        .from('timeline_events')
        .insert({
          candidate_id: candidateId,
          type: 'system_log',
          content: {
            message: `AI 매칭 분석이 완료되었습니다. 점수: ${score}점`,
            action: 'ai_analysis_completed',
            score: score,
          },
          created_by: user.userId,
        })
        .select();

      if (timelineError) {
        console.error('[analyzeCandidateMatch] 타임라인 이벤트 생성 실패:', {
          error: timelineError,
          code: timelineError.code,
          message: timelineError.message,
          candidateId,
        });
        // 타임라인 이벤트 생성 실패는 치명적이지 않으므로 계속 진행
      } else {
        console.log(`[analyzeCandidateMatch] 타임라인 이벤트 생성 성공:`, timelineData?.[0]?.id);
      }
    } catch (timelineErr) {
      // 타임라인 이벤트 생성 실패는 치명적이지 않으므로 로그만 남기고 계속 진행
      console.error('[analyzeCandidateMatch] 타임라인 이벤트 생성 중 예외 발생:', timelineErr);
    }

    console.log(`[analyzeCandidateMatch] 분석 완료 - 점수: ${score}`);

    // 참고: revalidatePath는 render 중에 호출할 수 없으므로 제거
    // 클라이언트에서 polling이나 별도 메커니즘으로 상태를 확인하도록 함

    return {
      score,
      summary: analysisResult.summary,
      strengths: analysisResult.strengths.slice(0, 5),
      weaknesses: analysisResult.weaknesses.slice(0, 5),
      interviewQuestions: interviewQuestionsNormalized,
    };
  } catch (error) {
    console.error('[analyzeCandidateMatch] 분석 실패:', error);

    // 에러 발생 시 상태·요약을 함께 갱신해 Insight 탭에서 "업로드하세요"와 구분되게 합니다.
    const failureSummary = formatAnalysisFailureSummary(error);

    try {
      const supabase = createServiceClient();
      await supabase
        .from('candidates')
        .update({
          ai_analysis_status: 'failed',
          ai_summary: failureSummary,
        })
        .eq('id', candidateId);
    } catch (updateError) {
      console.error('[analyzeCandidateMatch] 상태 업데이트 실패:', updateError);
    }

    // 에러를 다시 throw하여 호출자가 처리할 수 있도록 함
    throw error;
  }
}

/** AI 분석 실패 시 DB ai_summary에 넣을 사용자용 짧은 메시지 */
function formatAnalysisFailureSummary(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  if (msg.includes('GOOGLE_GEMINI_API_KEY')) {
    return 'AI 분석을 실행할 수 없습니다. 서버 환경 변수 GOOGLE_GEMINI_API_KEY가 올바르게 설정되어 있는지 확인해 주세요.';
  }
  if (msg.includes('AI 응답 파싱 실패') || msg.includes('JSON')) {
    return 'AI 응답을 해석하는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
  }
  const clipped = msg.length > 280 ? `${msg.slice(0, 280)}…` : msg;
  return `AI 분석 중 오류가 발생했습니다: ${clipped}`;
}
