import { useState } from 'react';
import { Upload, Linkedin, Mail, User, CheckCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { VNTGSymbol } from '../vntg/VNTGSymbol';

export function JobApplicationPage() {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    linkedin: '',
  });
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.type === 'application/pdf' || file.name.endsWith('.pdf'))) {
      setResumeFile(file);
    } else {
      alert('PDF 파일만 업로드 가능합니다.');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setResumeFile(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resumeFile) {
      alert('이력서를 업로드해주세요.');
      return;
    }
    if (!formData.fullName || !formData.email) {
      alert('필수 정보를 입력해주세요.');
      return;
    }
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-8">
        <div className="max-w-2xl w-full text-center">
          <VNTGSymbol size={80} className="text-[#0248FF] mx-auto mb-8" />
          <CheckCircle size={64} className="text-[#0248FF] mx-auto mb-6" />
          <h1 className="text-4xl mb-4" style={{ fontFamily: 'Roboto, sans-serif' }}>
            Application Submitted!
          </h1>
          <p className="text-xl text-gray-600 mb-8" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
            지원해주셔서 감사합니다. 빠른 시일 내에 연락드리겠습니다.
          </p>
          <Button
            onClick={() => setSubmitted(false)}
            className="bg-[#0248FF] hover:bg-[#0236cc] text-white"
            style={{ fontFamily: 'Noto Sans KR, sans-serif' }}
          >
            다른 포지션 지원하기
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="bg-[#08102B] text-white px-8 py-6">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <VNTGSymbol size={40} className="text-[#0248FF]" />
          <div>
            <h1 className="text-2xl" style={{ fontFamily: 'Roboto, sans-serif' }}>
              VNTG
            </h1>
            <p className="text-sm text-gray-400" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
              혁신을 만드는 사람들
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-12">
            <h2 className="text-4xl mb-3" style={{ fontFamily: 'Roboto, sans-serif' }}>
              Senior Product Designer
            </h2>
            <p className="text-xl text-gray-600" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
              간단한 정보만 입력하면 지원이 완료됩니다.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Resume Upload */}
            <div>
              <label className="block mb-3 text-lg" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                이력서 업로드
              </label>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer ${
                  isDragging
                    ? 'border-[#0248FF] bg-blue-50'
                    : resumeFile
                    ? 'border-[#5287FF] bg-blue-50'
                    : 'border-[#5287FF] hover:border-[#0248FF] hover:bg-gray-50'
                }`}
              >
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="resume-upload"
                />
                <label htmlFor="resume-upload" className="cursor-pointer">
                  <Upload
                    size={48}
                    className={`mx-auto mb-4 ${resumeFile ? 'text-[#0248FF]' : 'text-[#5287FF]'}`}
                  />
                  {resumeFile ? (
                    <div>
                      <p className="text-lg mb-2" style={{ fontFamily: 'Roboto, sans-serif' }}>
                        ✓ {resumeFile.name}
                      </p>
                      <p className="text-sm text-gray-500" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                        다시 업로드하려면 클릭하세요
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-lg mb-2" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                        이력서를 드래그하거나 클릭하여 업로드
                      </p>
                      <p className="text-sm text-gray-500" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                        PDF 형식만 지원됩니다
                      </p>
                    </div>
                  )}
                </label>
              </div>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-1 gap-6">
              <div>
                <label className="block mb-2" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                  <span className="flex items-center gap-2">
                    <User size={20} className="text-[#0248FF]" />
                    성명 <span className="text-red-500">*</span>
                  </span>
                </label>
                <Input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="홍길동"
                  className="h-12 text-base border-2 focus:border-[#0248FF]"
                  style={{ fontFamily: 'Noto Sans KR, sans-serif' }}
                  required
                />
              </div>

              <div>
                <label className="block mb-2" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                  <span className="flex items-center gap-2">
                    <Mail size={20} className="text-[#0248FF]" />
                    이메일 <span className="text-red-500">*</span>
                  </span>
                </label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="example@email.com"
                  className="h-12 text-base border-2 focus:border-[#0248FF]"
                  style={{ fontFamily: 'Roboto, sans-serif' }}
                  required
                />
              </div>

              <div>
                <label className="block mb-2" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                  <span className="flex items-center gap-2">
                    <Linkedin size={20} className="text-[#0248FF]" />
                    LinkedIn 프로필 (선택)
                  </span>
                </label>
                <Input
                  type="url"
                  value={formData.linkedin}
                  onChange={(e) => setFormData({ ...formData, linkedin: e.target.value })}
                  placeholder="linkedin.com/in/yourprofile"
                  className="h-12 text-base border-2 focus:border-[#0248FF]"
                  style={{ fontFamily: 'Roboto, sans-serif' }}
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="text-center pt-4">
              <Button
                type="submit"
                className="bg-[#0248FF] hover:bg-[#0236cc] text-white px-16 py-6 text-lg"
                style={{ fontFamily: 'Noto Sans KR, sans-serif' }}
              >
                지원하기
              </Button>
              <p className="text-sm text-gray-500 mt-4" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                지원 완료까지 30초면 충분합니다
              </p>
            </div>
          </form>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gray-50 py-6 text-center">
        <VNTGSymbol size={32} className="text-[#0248FF] mx-auto mb-2 opacity-30" />
        <p className="text-sm text-gray-500" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
          © 2026 VNTG. Powered by AI.
        </p>
      </div>
    </div>
  );
}
