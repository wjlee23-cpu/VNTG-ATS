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
}> {
  try {
    console.log(`[analyzeCandidateMatch] 분석 시작 - 후보자 ID: ${candidateId}, 채용 공고 ID: ${jobPostId}`);

    // 환경변수 확인
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey || apiKey.length < 20) {
      throw new Error('GOOGLE_GEMINI_API_KEY가 설정되지 않았거나 유효하지 않습니다.');
    }

    // Supabase 클라이언트 생성 (Service Client 사용하여 RLS 우회)
    const supabase = createServiceClient();

    // 1. 후보자 데이터 조회
    const { data: candidate, error: candidateError } = await supabase
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

    // 6. Gemini API 호출
    // gemini-2.5-flash 모델 사용 (v1beta API에서 지원)
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: {
        response_mime_type: 'application/json',
        temperature: 0.7,
        topP: 0.95,
        topK: 40,
      },
    });

    // 프롬프트 구성
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
${hasResumeFile ? '**이력서 파일**: 첨부됨' : '**이력서 파일**: 없음'}

## 분석 요청사항
다음 JSON 형식으로 응답해주세요:
{
  "score": 0-100 사이의 정수 (JD와의 적합도 점수),
  "summary": "2-3줄로 요약한 지원자 적합도 평가 (한국어, 자연스러운 문체)",
  "strengths": ["강점 1", "강점 2", "강점 3"] (최대 5개, 한국어),
  "weaknesses": ["보완점 1", "보완점 2"] (최대 5개, 한국어)
}

## 평가 기준
1. **기술 스킬 매칭도**: JD에서 요구하는 기술 스택과 지원자의 보유 스킬 일치도
2. **경력 적합성**: 지원자의 경력이 JD 요구사항과 얼마나 부합하는지
3. **학력 및 자격**: 학력, 자격증 등이 포지션에 적합한지
4. **전체적인 적합도**: 종합적인 평가

점수는 엄격하게 평가하되, 공정하고 객관적으로 평가해주세요. 80점 이상은 매우 우수한 적합도, 60-79점은 양호한 적합도, 40-59점은 보통, 40점 미만은 낮은 적합도로 판단합니다.

반드시 유효한 JSON 형식으로만 응답해주세요. 다른 설명이나 마크다운 없이 순수 JSON만 반환해주세요.`;

    console.log('[analyzeCandidateMatch] Gemini API 호출 중...');
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text().trim();

    console.log('[analyzeCandidateMatch] Gemini API 응답 수신:', text.substring(0, 200) + '...');

    // 7. JSON 파싱
    let analysisResult: {
      score: number;
      summary: string;
      strengths: string[];
      weaknesses: string[];
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

    // 점수를 정수로 변환
    const score = Math.round(Math.max(0, Math.min(100, analysisResult.score)));

    // 9. DB에 결과 저장
    const { error: updateError } = await supabase
      .from('candidates')
      .update({
        ai_score: score,
        ai_summary: analysisResult.summary,
        ai_strengths: analysisResult.strengths.slice(0, 5), // 최대 5개
        ai_weaknesses: analysisResult.weaknesses.slice(0, 5), // 최대 5개
        ai_analysis_status: 'completed',
      })
      .eq('id', candidateId);

    if (updateError) {
      console.error('[analyzeCandidateMatch] DB 업데이트 실패:', updateError);
      throw new Error(`분석 결과 저장 실패: ${updateError.message}`);
    }

    // 10. 타임라인 이벤트 생성
    const user = await getCurrentUser();
    await supabase.from('timeline_events').insert({
      candidate_id: candidateId,
      type: 'system_log',
      content: {
        message: `AI 매칭 분석이 완료되었습니다. 점수: ${score}점`,
        action: 'ai_analysis_completed',
        score: score,
      },
      created_by: user.userId,
    }).catch((err) => {
      // 타임라인 이벤트 생성 실패는 치명적이지 않으므로 로그만 남김
      console.error('[analyzeCandidateMatch] 타임라인 이벤트 생성 실패:', err);
    });

    console.log(`[analyzeCandidateMatch] 분석 완료 - 점수: ${score}`);

    return {
      score,
      summary: analysisResult.summary,
      strengths: analysisResult.strengths.slice(0, 5),
      weaknesses: analysisResult.weaknesses.slice(0, 5),
    };
  } catch (error) {
    console.error('[analyzeCandidateMatch] 분석 실패:', error);

    // 에러 발생 시 상태를 'failed'로 업데이트
    try {
      const supabase = createServiceClient();
      await supabase
        .from('candidates')
        .update({ ai_analysis_status: 'failed' })
        .eq('id', candidateId);
    } catch (updateError) {
      console.error('[analyzeCandidateMatch] 상태 업데이트 실패:', updateError);
    }

    // 에러를 다시 throw하여 호출자가 처리할 수 있도록 함
    throw error;
  }
}
