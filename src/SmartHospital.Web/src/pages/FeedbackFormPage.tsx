import { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  Container, Typography, Box, Button, Stepper, Step, StepLabel,
  Card, CardContent, ToggleButtonGroup, ToggleButton, TextField,
  MenuItem, Select, FormControl, InputLabel, Alert, Grow, Switch,
  FormControlLabel, IconButton, LinearProgress, Tooltip, CircularProgress,
  Chip, Divider,
} from '@mui/material';
import { SentimentVeryDissatisfied, SentimentDissatisfied, SentimentSatisfied, SentimentVerySatisfied, CheckCircle, Mic, MicOff, VolumeUp, NavigateNext, NavigateBefore, CameraAlt, UploadFile, DocumentScanner, Edit, RecordVoiceOver } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

interface Question {
  id: number; category: string; type: string; textRO: string; textEN: string;
  orderIndex: number; isRequired: boolean; isCorruptionAlert: boolean;
  optionsJson: string | null; wizardStep: number;
}

interface Dept { id: number; name: string; nameEN: string; specialty: string; }

export default function FeedbackFormPage() {
  const { hospitalId } = useParams<{ hospitalId: string }>();   
  const [searchParams] = useSearchParams();
  const deptParam = searchParams.get('dept');
  const { t, i18n } = useTranslation();
  const { user } = useAuth();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [hospitalName, setHospitalName] = useState('');
  const [steps, setSteps] = useState<number[]>([]);
  const [activeStep, setActiveStep] = useState(0);
  const [assistedMode, setAssistedMode] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [inputMode, setInputMode] = useState<'normal' | 'assisted' | 'scan'>('normal');

  // Scan mode state
  const [scanImage, setScanImage] = useState<File | null>(null);
  const [scanPreview, setScanPreview] = useState<string>('');
  const [scanLoading, setScanLoading] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [scanError, setScanError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [gender, setGender] = useState<string>('');
  const [age, setAge] = useState<string>('');
  const [departmentId, setDepartmentId] = useState<string>(deptParam || '');
  const [filledBy, setFilledBy] = useState<string>('Patient');
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [answers, setAnswers] = useState<Record<number, { ratingValue?: number; textValue?: string; selectedOption?: string }>>({});

  // Assisted mode: one-question-at-a-time index
  const [assistedQIdx, setAssistedQIdx] = useState(0);
  // Assisted mode: basic info field index (step 0)
  const [assistedFieldIdx, setAssistedFieldIdx] = useState(0);
  // Voice input state
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  // TTS state
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [, setVoicesLoaded] = useState(false);

  // Preload speech synthesis voices
  useEffect(() => {
    if ('speechSynthesis' in window) {
      const loadVoices = () => setVoicesLoaded(true);
      window.speechSynthesis.onvoiceschanged = loadVoices;
      if (window.speechSynthesis.getVoices().length > 0) setVoicesLoaded(true);
    }
  }, []);

  // Web Speech API - Voice Recognition
  const startListening = (questionId: number) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = i18n.language === 'ro' ? 'ro-RO' : 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setAnswer(questionId, { textValue: transcript });
    };
    recognition.onend = () => setIsListening(false);
    recognition.start();
    recognitionRef.current = recognition;
    setIsListening(true);
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  // Text-to-Speech
  const speakText = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const targetLang = i18n.language === 'ro' ? 'ro' : 'en';
    utterance.lang = targetLang === 'ro' ? 'ro-RO' : 'en-US';
    utterance.rate = 0.85;
    // Explicitly select a voice matching the target language
    const voices = window.speechSynthesis.getVoices();
    const matchingVoice = voices.find(v => v.lang.startsWith(targetLang) && v.localService) ||
                          voices.find(v => v.lang.startsWith(targetLang));
    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }
    utterance.onend = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  // Auto-speak question in assisted mode
  useEffect(() => {
    if (assistedMode && activeStep > 0 && currentQuestions.length > 0) {
      const q = currentQuestions[assistedQIdx];
      if (q) {
        const text = i18n.language === 'en' ? q.textEN : q.textRO;
        setTimeout(() => speakText(text), 400);
      }
    }
    if (assistedMode && activeStep === 0) {
      const labels = [t('feedback.gender'), t('feedback.age'), t('feedback.department'), t('feedback.filledBy')];
      setTimeout(() => speakText(labels[assistedFieldIdx] || ''), 400);
    }
    return () => { window.speechSynthesis?.cancel(); };
  }, [assistedQIdx, assistedFieldIdx, activeStep, assistedMode]);

  // Reset assisted question index on step change
  useEffect(() => { setAssistedQIdx(0); setAssistedFieldIdx(0); }, [activeStep]);
  useEffect(() => {
    if (hospitalId) {
      api.get(`/feedback/questionnaire/${hospitalId}`).then(res => {
        if (!res.data || typeof res.data !== 'object') return;
        setQuestions(Array.isArray(res.data.questions) ? res.data.questions : []);
        setDepartments(Array.isArray(res.data.departments) ? res.data.departments : []);
        setHospitalName(i18n.language === 'en' ? res.data.hospitalNameEN || res.data.hospitalName : res.data.hospitalName);
        setSteps([0, ...(Array.isArray(res.data.wizardSteps) ? res.data.wizardSteps : [])]);
      }).catch(() => {});
    }
  }, [hospitalId]);

  const stepLabels = [
    t('feedback.basicInfo'),
    t('feedback.overallSatisfaction'),
    t('feedback.staffEvaluation'),
    t('feedback.services'),
    t('feedback.services'),
    t('feedback.medicalInfo'),
    t('feedback.careCorruption'),
    t('feedback.comments'),
  ];

  const currentQuestions = questions.filter(q => q.wizardStep === steps[activeStep]);

  const setAnswer = (qId: number, value: Partial<{ ratingValue: number; textValue: string; selectedOption: string }>) => {
    setAnswers(prev => ({ ...prev, [qId]: { ...prev[qId], ...value } }));
  };

  const handleSubmit = async () => {
    const feedbackAnswers = Object.entries(answers).map(([qId, ans]) => ({
      questionId: parseInt(qId),
      ratingValue: ans.ratingValue ?? null,
      textValue: ans.textValue ?? null,
      selectedOption: ans.selectedOption ?? null,
    }));

    await api.post('/feedback/submit', {
      hospitalId: parseInt(hospitalId!),
      departmentId: departmentId ? parseInt(departmentId) : null,
      patientGender: gender === 'Male' ? 0 : gender === 'Female' ? 1 : null,
      patientAge: age ? parseInt(age) : null,
      filledBy: filledBy === 'Patient' ? 0 : filledBy === 'Relative' ? 1 : 2,
      isAnonymous: isAnonymous,
      answers: feedbackAnswers,
    });

    setSubmitted(true);
  };

  const handleScanImage = (file: File | null) => {
    if (!file) return;
    setScanImage(file);
    setScanPreview(URL.createObjectURL(file));
    setScanResult(null);
    setScanError('');
  };

  const handleScanSubmit = async () => {
    if (!scanImage || !hospitalId) return;
    setScanLoading(true);
    setScanError('');
    setScanResult(null);

    const formData = new FormData();
    formData.append('image', scanImage);

    try {
      const res = await api.post(`/feedback/scan/${hospitalId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data.success) {
        setScanResult(res.data.parsed);
      } else {
        setScanError(res.data.message || (i18n.language === 'ro' ? 'Nu s-a putut citi formularul.' : 'Could not read the form.'));
      }
    } catch (err: any) {
      setScanError(err?.response?.data?.message || (i18n.language === 'ro' ? 'Eroare la scanare.' : 'Scan error.'));
    } finally {
      setScanLoading(false);
    }
  };

  const applyScanResults = () => {
    if (!scanResult) return;
    // Apply parsed data to form state
    if (scanResult.patientGender) setGender(scanResult.patientGender);
    if (scanResult.patientAge) setAge(String(scanResult.patientAge));
    if (scanResult.departmentId) setDepartmentId(String(scanResult.departmentId));
    if (scanResult.filledBy) setFilledBy(scanResult.filledBy);
    if (scanResult.answers) {
      const newAnswers: Record<number, { ratingValue?: number; textValue?: string; selectedOption?: string }> = {};
      for (const ans of scanResult.answers) {
        newAnswers[ans.questionId] = {
          ratingValue: ans.ratingValue ?? undefined,
          textValue: ans.textValue ?? undefined,
          selectedOption: ans.selectedOption ?? undefined,
        };
      }
      setAnswers(newAnswers);
    }
    // Switch to normal mode for review and submission
    setInputMode('normal');
    setAssistedMode(false);
    setActiveStep(0);
  };

  const fontSize = assistedMode ? '1.2rem' : '1rem';

  if (submitted) {
    return (
      <Container maxWidth="sm" sx={{ py: 8, textAlign: 'center' }}>
        <Grow in><CheckCircle sx={{ fontSize: 80, color: 'success.main', mb: 2 }} /></Grow>
        <Typography variant="h4" gutterBottom>{t('feedback.thankYou')}</Typography>
        <Typography color="text.secondary" sx={{ mb: 4 }}>{t('feedback.thankYouMessage')}</Typography>
        <Button variant="contained" onClick={() => { setSubmitted(false); setActiveStep(0); setAnswers({}); }}>
          {t('feedback.newFeedback')}
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>{t('feedback.title')}</Typography>
      <Typography color="text.secondary" sx={{ mb: 1 }}>{hospitalName}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>{t('feedback.subtitle')}</Typography>

      {/* Input Mode Selector */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
          {i18n.language === 'ro' ? 'Canal de introducere' : 'Input Channel'}
        </Typography>
        <ToggleButtonGroup
          value={inputMode}
          exclusive
          onChange={(_, v) => { if (v) { setInputMode(v); setAssistedMode(v === 'assisted'); } }}
          sx={{
            width: '100%',
            '& .MuiToggleButton-root': {
              flex: 1,
              py: 1.5,
              px: 2,
              borderRadius: '12px !important',
              border: '2px solid',
              borderColor: 'divider',
              mx: 0.5,
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.9rem',
              gap: 1,
              transition: 'all 0.2s ease',
              '&:first-of-type': { ml: 0 },
              '&:last-of-type': { mr: 0 },
              '&.Mui-selected': {
                borderColor: 'primary.main',
                bgcolor: 'primary.main',
                color: 'white',
                boxShadow: '0 4px 12px rgba(25, 118, 210, 0.3)',
                '&:hover': { bgcolor: 'primary.dark' },
              },
              '&:hover': { bgcolor: 'action.hover' },
            },
          }}
        >
          <ToggleButton value="normal">
            <Edit sx={{ fontSize: 20 }} />
            Standard
          </ToggleButton>
          <ToggleButton value="assisted">
            <RecordVoiceOver sx={{ fontSize: 20 }} />
            Audio+Visual
          </ToggleButton>
          <ToggleButton value="scan">
            <DocumentScanner sx={{ fontSize: 20 }} />
            {i18n.language === 'ro' ? 'Scanează' : 'Scan'}
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* SCAN MODE */}
      {inputMode === 'scan' && (
        <Card sx={{ p: 3, mb: 4, border: '1px solid', borderColor: 'primary.light' }}>
          <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <DocumentScanner color="primary" />
            {i18n.language === 'ro' ? 'Scanare formular fizic' : 'Scan Physical Form'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {i18n.language === 'ro'
              ? 'Fotografiază sau încarcă o imagine a formularului de feedback completat. AI-ul va extrage automat răspunsurile.'
              : 'Take a photo or upload an image of the completed feedback form. AI will automatically extract the answers.'}
          </Typography>

          {/* Upload buttons */}
          <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              startIcon={<CameraAlt />}
              onClick={() => cameraInputRef.current?.click()}
            >
              {i18n.language === 'ro' ? 'Fotografiază' : 'Take Photo'}
            </Button>
            <Button
              variant="outlined"
              startIcon={<UploadFile />}
              onClick={() => fileInputRef.current?.click()}
            >
              {i18n.language === 'ro' ? 'Încarcă imagine' : 'Upload Image'}
            </Button>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={e => handleScanImage(e.target.files?.[0] || null)}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              style={{ display: 'none' }}
              onChange={e => handleScanImage(e.target.files?.[0] || null)}
            />
          </Box>

          {/* Preview */}
          {scanPreview && (
            <Box sx={{ mb: 3 }}>
              <img
                src={scanPreview}
                alt="Scanned form"
                style={{ maxWidth: '100%', maxHeight: 400, borderRadius: 8, border: '1px solid #e0e0e0' }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                {scanImage?.name} ({(scanImage?.size ?? 0 / 1024).toFixed(0)} KB)
              </Typography>
            </Box>
          )}

          {/* Scan button */}
          {scanImage && !scanResult && (
            <Button
              variant="contained"
              color="primary"
              onClick={handleScanSubmit}
              disabled={scanLoading}
              startIcon={scanLoading ? <CircularProgress size={18} /> : <DocumentScanner />}
              sx={{ mb: 2 }}
            >
              {scanLoading
                ? (i18n.language === 'ro' ? 'Se procesează cu AI...' : 'Processing with AI...')
                : (i18n.language === 'ro' ? 'Analizează cu AI' : 'Analyze with AI')}
            </Button>
          )}

          {/* Error */}
          {scanError && (
            <Alert severity="error" sx={{ mb: 2 }}>{scanError}</Alert>
          )}

          {/* Results */}
          {scanResult && (
            <Box>
              <Alert severity="success" sx={{ mb: 2 }}>
                {i18n.language === 'ro'
                  ? `Formularul a fost scanat cu succes! Încredere: ${Math.round((scanResult.confidence || 0.8) * 100)}%`
                  : `Form scanned successfully! Confidence: ${Math.round((scanResult.confidence || 0.8) * 100)}%`}
              </Alert>

              {scanResult.notes && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  {scanResult.notes}
                </Alert>
              )}

              {/* Summary of extracted data */}
              <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1, mb: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  {i18n.language === 'ro' ? 'Date extrase:' : 'Extracted Data:'}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                  {scanResult.patientGender && <Chip size="small" label={`${i18n.language === 'ro' ? 'Gen' : 'Gender'}: ${scanResult.patientGender}`} />}
                  {scanResult.patientAge && <Chip size="small" label={`${i18n.language === 'ro' ? 'Vârstă' : 'Age'}: ${scanResult.patientAge}`} />}
                  {scanResult.departmentId && <Chip size="small" label={`${i18n.language === 'ro' ? 'Secție' : 'Dept'}: ${departments.find(d => d.id === scanResult.departmentId)?.name || scanResult.departmentId}`} />}
                  {scanResult.filledBy && <Chip size="small" label={`${i18n.language === 'ro' ? 'Completat de' : 'Filled by'}: ${scanResult.filledBy}`} />}
                </Box>
                <Divider sx={{ my: 1 }} />
                <Typography variant="caption" color="text.secondary">
                  {i18n.language === 'ro'
                    ? `${scanResult.answers?.length || 0} răspunsuri extrase din ${questions.length} întrebări`
                    : `${scanResult.answers?.length || 0} answers extracted from ${questions.length} questions`}
                </Typography>

                {/* Show extracted answers */}
                {scanResult.answers?.map((ans: any) => {
                  const q = questions.find(qq => qq.id === ans.questionId);
                  if (!q) return null;
                  return (
                    <Box key={ans.questionId} sx={{ mt: 1, pl: 1, borderLeft: '2px solid', borderColor: 'primary.light' }}>
                      <Typography variant="caption" color="text.secondary">
                        {i18n.language === 'ro' ? q.textRO : q.textEN}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {ans.ratingValue != null && `${ans.ratingValue}/4`}
                        {ans.selectedOption && ans.selectedOption}
                        {ans.textValue && `"${ans.textValue}"`}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>

              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  variant="contained"
                  color="success"
                  onClick={applyScanResults}
                >
                  {i18n.language === 'ro' ? 'Confirmă și revizuiește' : 'Confirm & Review'}
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => { setScanResult(null); setScanImage(null); setScanPreview(''); }}
                >
                  {i18n.language === 'ro' ? 'Scanează din nou' : 'Scan Again'}
                </Button>
              </Box>
            </Box>
          )}
        </Card>
      )}

      {/* NORMAL / ASSISTED MODE */}
      {inputMode !== 'scan' && (<>

      <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4 }}>
        {steps.map((_, idx) => (
          <Step key={idx}><StepLabel>{!assistedMode && stepLabels[idx]}</StepLabel></Step>
        ))}
      </Stepper>

      <Card sx={{ minHeight: 300 }}>
        <CardContent sx={{ p: assistedMode ? 4 : 3 }}>
          {/* Step 0: Basic Info */}
          {activeStep === 0 && !assistedMode && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Typography variant="h6" sx={{ fontSize }}>{t('feedback.basicInfo')}</Typography>

              <FormControl fullWidth>
                <InputLabel>{t('feedback.gender')}</InputLabel>
                <Select value={gender} label={t('feedback.gender')} onChange={e => setGender(e.target.value)}>
                  <MenuItem value="Male">{t('feedback.male')}</MenuItem>
                  <MenuItem value="Female">{t('feedback.female')}</MenuItem>
                </Select>
              </FormControl>

              <TextField label={t('feedback.age')} type="number" value={age}
                onChange={e => setAge(e.target.value)} slotProps={{ htmlInput: { min: 0, max: 120 } }} />

              <FormControl fullWidth>
                <InputLabel>{t('feedback.department')}</InputLabel>
                <Select value={departmentId} label={t('feedback.department')} onChange={e => setDepartmentId(e.target.value)}>
                  <MenuItem value="">{t('feedback.selectDepartment')}</MenuItem>
                  {departments.map(d => (
                    <MenuItem key={d.id} value={d.id.toString()}>
                      {i18n.language === 'en' && d.nameEN ? d.nameEN : d.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>{t('feedback.filledBy')}</InputLabel>
                <Select value={filledBy} label={t('feedback.filledBy')} onChange={e => setFilledBy(e.target.value)}>
                  <MenuItem value="Patient">{t('feedback.patient')}</MenuItem>
                  <MenuItem value="Relative">{t('feedback.relative')}</MenuItem>
                  <MenuItem value="Caregiver">{t('feedback.caregiver')}</MenuItem>
                </Select>
              </FormControl>

              {user && (
                <Box sx={{ p: 2, bgcolor: isAnonymous ? 'grey.50' : 'success.50', borderRadius: 1, border: '1px solid', borderColor: isAnonymous ? 'grey.300' : 'success.light' }}>
                  <FormControlLabel
                    control={<Switch checked={!isAnonymous} onChange={(_, v) => setIsAnonymous(!v)} />}
                    label={i18n.language === 'ro' ? 'Permite contactarea mea de către administrație' : 'Allow administration to contact me'}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 6 }}>
                    {isAnonymous
                      ? (i18n.language === 'ro' ? 'Feedback-ul va fi trimis anonim. Identitatea ta nu va fi vizibilă.' : 'Feedback will be submitted anonymously. Your identity will not be visible.')
                      : (i18n.language === 'ro' ? `Feedback-ul va fi asociat cu contul tău (${user.email}). Managerii pot lua legătura cu tine.` : `Feedback will be linked to your account (${user.email}). Managers may contact you.`)
                    }
                  </Typography>
                </Box>
              )}
            </Box>
          )}

          {/* Step 0: Basic Info - ASSISTED MODE (one field at a time, big buttons) */}
          {activeStep === 0 && assistedMode && (() => {
            const fields = [
              { id: 'gender', label: t('feedback.gender') },
              { id: 'age', label: t('feedback.age') },
              { id: 'department', label: t('feedback.department') },
              { id: 'filledBy', label: t('feedback.filledBy') },
            ];
            const currentField = fields[assistedFieldIdx];
            return (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center' }}>
                {/* Progress */}
                <Box sx={{ width: '100%', mb: 1 }}>
                  <LinearProgress
                    variant="determinate"
                    value={((assistedFieldIdx + 1) / fields.length) * 100}
                    sx={{ height: 8, borderRadius: 4, mb: 1 }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', display: 'block' }}>
                    {assistedFieldIdx + 1} / {fields.length}
                  </Typography>
                </Box>

                {/* Question label with speaker */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="h5" sx={{ fontWeight: 600, textAlign: 'center' }}>
                    {currentField.label}
                  </Typography>
                  <Tooltip title={t('feedback.listenQuestion')}>
                    <IconButton onClick={() => speakText(currentField.label)} color={isSpeaking ? 'primary' : 'default'}>
                      <VolumeUp />
                    </IconButton>
                  </Tooltip>
                </Box>

                {/* Gender - big icon buttons */}
                {currentField.id === 'gender' && (
                  <Box sx={{ display: 'flex', gap: 4, justifyContent: 'center', mt: 2 }}>
                    <Button
                      variant={gender === 'Male' ? 'contained' : 'outlined'}
                      onClick={() => setGender('Male')}
                      sx={{ flexDirection: 'column', py: 3, px: 5, minWidth: 160, minHeight: 140, borderRadius: 4, fontSize: '1.3rem', fontWeight: 600,
                        borderWidth: gender === 'Male' ? 3 : 2, transition: 'all 0.2s', '&:hover': { transform: 'scale(1.05)' } }}
                    >
                      <Box sx={{ fontSize: '3rem', mb: 1 }}>👨</Box>
                      {t('feedback.male')}
                    </Button>
                    <Button
                      variant={gender === 'Female' ? 'contained' : 'outlined'}
                      onClick={() => setGender('Female')}
                      sx={{ flexDirection: 'column', py: 3, px: 5, minWidth: 160, minHeight: 140, borderRadius: 4, fontSize: '1.3rem', fontWeight: 600,
                        borderWidth: gender === 'Female' ? 3 : 2, transition: 'all 0.2s', '&:hover': { transform: 'scale(1.05)' } }}
                    >
                      <Box sx={{ fontSize: '3rem', mb: 1 }}>👩</Box>
                      {t('feedback.female')}
                    </Button>
                  </Box>
                )}

                {/* Age - big number buttons in ranges */}
                {currentField.id === 'age' && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center', mt: 2, width: '100%' }}>
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                      {[
                        { label: '< 18', range: '15' },
                        { label: '18-30', range: '25' },
                        { label: '31-45', range: '38' },
                        { label: '46-60', range: '53' },
                        { label: '61-75', range: '68' },
                        { label: '75+', range: '80' },
                      ].map(r => (
                        <Button key={r.range}
                          variant={age === r.range ? 'contained' : 'outlined'}
                          onClick={() => setAge(r.range)}
                          sx={{ py: 2.5, px: 3, minWidth: 100, minHeight: 80, borderRadius: 3, fontSize: '1.3rem', fontWeight: 700,
                            borderWidth: age === r.range ? 3 : 2, transition: 'all 0.2s', '&:hover': { transform: 'scale(1.05)' } }}
                        >
                          {r.label}
                        </Button>
                      ))}
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {i18n.language === 'en' ? 'Or type exact age:' : 'Sau introduceți vârsta exactă:'}
                    </Typography>
                    <TextField
                      type="number" value={age}
                      onChange={e => setAge(e.target.value)}
                      slotProps={{ htmlInput: { min: 0, max: 120, style: { fontSize: '1.5rem', textAlign: 'center' } } }}
                      sx={{ width: 150, '& .MuiInputBase-root': { borderRadius: 3 } }}
                    />
                  </Box>
                )}

                {/* Department - big list buttons */}
                {currentField.id === 'department' && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%', mt: 2 }}>
                    {departments.map(d => (
                      <Button key={d.id}
                        variant={departmentId === d.id.toString() ? 'contained' : 'outlined'}
                        onClick={() => setDepartmentId(d.id.toString())}
                        sx={{ justifyContent: 'flex-start', py: 2.5, px: 3, fontSize: '1.2rem', borderRadius: 3, fontWeight: 600,
                          borderWidth: departmentId === d.id.toString() ? 3 : 2, transition: 'all 0.2s' }}
                      >
                        🏥 {i18n.language === 'en' && d.nameEN ? d.nameEN : d.name}
                      </Button>
                    ))}
                  </Box>
                )}

                {/* FilledBy - big icon buttons */}
                {currentField.id === 'filledBy' && (
                  <Box sx={{ display: 'flex', gap: 3, justifyContent: 'center', flexWrap: 'wrap', mt: 2 }}>
                    {[
                      { value: 'Patient', label: t('feedback.patient'), icon: '🧑‍⚕️' },
                      { value: 'Relative', label: t('feedback.relative'), icon: '👨‍👩‍👧' },
                      { value: 'Caregiver', label: t('feedback.caregiver'), icon: '🤝' },
                    ].map(opt => (
                      <Button key={opt.value}
                        variant={filledBy === opt.value ? 'contained' : 'outlined'}
                        onClick={() => setFilledBy(opt.value)}
                        sx={{ flexDirection: 'column', py: 3, px: 4, minWidth: 150, minHeight: 130, borderRadius: 4, fontSize: '1.1rem', fontWeight: 600,
                          borderWidth: filledBy === opt.value ? 3 : 2, transition: 'all 0.2s', '&:hover': { transform: 'scale(1.05)' } }}
                      >
                        <Box sx={{ fontSize: '2.5rem', mb: 1 }}>{opt.icon}</Box>
                        {opt.label}
                      </Button>
                    ))}
                  </Box>
                )}

                {/* Intra-step navigation */}
                {fields.length > 1 && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3, mt: 3 }}>
                    <Button
                      variant="outlined"
                      startIcon={<NavigateBefore />}
                      disabled={assistedFieldIdx === 0}
                      onClick={() => setAssistedFieldIdx(i => i - 1)}
                      sx={{ fontSize: '1.1rem', py: 1.5, px: 3 }}
                    >
                      {i18n.language === 'en' ? 'Previous' : 'Precedenta'}
                    </Button>
                    <Button
                      variant="contained"
                      endIcon={<NavigateNext />}
                      disabled={assistedFieldIdx >= fields.length - 1}
                      onClick={() => setAssistedFieldIdx(i => i + 1)}
                      sx={{ fontSize: '1.1rem', py: 1.5, px: 3 }}
                    >
                      {i18n.language === 'en' ? 'Next' : 'Următorul'}
                    </Button>
                  </Box>
                )}
              </Box>
            );
          })()}

          {/* Question Steps */}
          {activeStep > 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {/* Assisted mode: one question at a time with progress */}
              {assistedMode && currentQuestions.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <LinearProgress
                    variant="determinate"
                    value={((assistedQIdx + 1) / currentQuestions.length) * 100}
                    sx={{ height: 8, borderRadius: 4, mb: 1 }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', display: 'block' }}>
                    {assistedQIdx + 1} / {currentQuestions.length}
                  </Typography>
                </Box>
              )}

              {(assistedMode ? [currentQuestions[assistedQIdx]].filter(Boolean) : currentQuestions).map(q => {
                const text = i18n.language === 'en' ? q.textEN : q.textRO;
                const options = q.optionsJson ? JSON.parse(q.optionsJson) as string[] : [];

                return (
                  <Box key={q.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <Typography sx={{ fontSize: assistedMode ? '1.5rem' : fontSize, fontWeight: 500, flexGrow: 1 }}>
                        {text} {q.isRequired && <span style={{ color: 'red' }}>*</span>}
                      </Typography>
                      {assistedMode && (
                        <Tooltip title={t('feedback.listenQuestion')}>
                          <IconButton
                            onClick={() => speakText(text)}
                            color={isSpeaking ? 'primary' : 'default'}
                            sx={{ bgcolor: 'action.hover' }}
                          >
                            <VolumeUp />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>

                    {q.isCorruptionAlert && (
                      <Alert severity="warning" sx={{ mb: 2 }}>
                        {i18n.language === 'en'
                          ? 'This question helps fight corruption. Your answer triggers an automatic alert.'
                          : 'Aceasta intrebare ajuta la combaterea coruptiei. Raspunsul dumneavoastra declanseaza o alerta automata.'}
                      </Alert>
                    )}

                    {q.type === 'Smiley' && (
                      <Box sx={{ display: 'flex', gap: assistedMode ? 4 : 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                        {[
                          { icon: <SentimentVerySatisfied sx={{ fontSize: assistedMode ? 64 : 30 }} />, label: options[0] || t('common.verySatisfied'), value: 4, color: '#2e7d32' },
                          { icon: <SentimentSatisfied sx={{ fontSize: assistedMode ? 64 : 30 }} />, label: options[1] || t('common.satisfied'), value: 3, color: '#1976d2' },
                          { icon: <SentimentDissatisfied sx={{ fontSize: assistedMode ? 64 : 30 }} />, label: options[2] || t('common.dissatisfied'), value: 2, color: '#ed6c02' },
                          { icon: <SentimentVeryDissatisfied sx={{ fontSize: assistedMode ? 64 : 30 }} />, label: options[3] || t('common.veryDissatisfied'), value: 1, color: '#d32f2f' },
                        ].map(opt => (
                          <Button key={opt.value}
                            variant={answers[q.id]?.ratingValue === opt.value ? 'contained' : 'outlined'}
                            onClick={() => setAnswer(q.id, { ratingValue: opt.value, selectedOption: opt.label })}
                            sx={{
                              flexDirection: 'column', py: assistedMode ? 3 : 2, px: assistedMode ? 4 : 3,
                              minWidth: assistedMode ? 140 : 90, minHeight: assistedMode ? 140 : 'auto',
                              borderRadius: assistedMode ? 4 : 1,
                              borderWidth: answers[q.id]?.ratingValue === opt.value ? 3 : 2,
                              borderColor: answers[q.id]?.ratingValue === opt.value ? opt.color : undefined,
                              bgcolor: answers[q.id]?.ratingValue === opt.value ? opt.color + '15' : undefined,
                              transition: 'all 0.2s ease',
                              '&:hover': { transform: assistedMode ? 'scale(1.08)' : 'none' },
                            }}>
                            {opt.icon}
                            <Typography variant={assistedMode ? 'body1' : 'caption'} sx={{ mt: 1, fontWeight: 600 }}>
                              {opt.label}
                            </Typography>
                          </Button>
                        ))}
                      </Box>
                    )}

                    {q.type === 'Rating' && (
                      <Box sx={{ display: 'flex', gap: assistedMode ? 3 : 2, flexWrap: 'wrap', justifyContent: assistedMode ? 'center' : 'flex-start' }}>
                        {options.map((opt, idx) => (
                          <Button key={idx}
                            variant={answers[q.id]?.selectedOption === opt ? 'contained' : 'outlined'}
                            color={idx === 0 ? 'success' : idx === 1 ? 'primary' : 'error'}
                            onClick={() => setAnswer(q.id, { ratingValue: options.length - idx, selectedOption: opt })}
                            sx={{
                              fontSize: assistedMode ? '1.3rem' : '0.9rem',
                              py: assistedMode ? 3 : 1, px: assistedMode ? 4 : 2,
                              minHeight: assistedMode ? 80 : 'auto',
                              borderRadius: assistedMode ? 3 : 1,
                              fontWeight: assistedMode ? 700 : 500,
                            }}>
                            {opt}
                          </Button>
                        ))}
                      </Box>
                    )}

                    {q.type === 'YesNo' && (
                      <Box sx={{ display: 'flex', gap: assistedMode ? 4 : 2, justifyContent: 'center' }}>
                        {assistedMode ? (
                          <>
                            <Button
                              variant={answers[q.id]?.selectedOption === 'Da' ? 'contained' : 'outlined'}
                              color={q.isCorruptionAlert ? 'error' : 'success'}
                              onClick={() => setAnswer(q.id, { selectedOption: 'Da', ratingValue: 1 })}
                              sx={{ fontSize: '1.5rem', py: 3, px: 6, minWidth: 140, minHeight: 100, borderRadius: 3, fontWeight: 700 }}
                            >
                              ✓ {t('common.yes')}
                            </Button>
                            <Button
                              variant={answers[q.id]?.selectedOption === 'Nu' ? 'contained' : 'outlined'}
                              color="error"
                              onClick={() => setAnswer(q.id, { selectedOption: 'Nu', ratingValue: 0 })}
                              sx={{ fontSize: '1.5rem', py: 3, px: 6, minWidth: 140, minHeight: 100, borderRadius: 3, fontWeight: 700 }}
                            >
                              ✗ {t('common.no')}
                            </Button>
                          </>
                        ) : (
                          <ToggleButtonGroup
                            exclusive
                            value={answers[q.id]?.selectedOption || ''}
                            onChange={(_, v) => v && setAnswer(q.id, { selectedOption: v, ratingValue: v === 'Da' ? 1 : 0 })}
                            size="medium">
                            <ToggleButton value="Da" color={q.isCorruptionAlert ? 'error' : 'primary'}>
                              {t('common.yes')}
                            </ToggleButton>
                            <ToggleButton value="Nu" color="primary">{t('common.no')}</ToggleButton>
                          </ToggleButtonGroup>
                        )}
                      </Box>
                    )}

                    {q.type === 'YesPartialNo' && (
                      <Box sx={{ display: 'flex', gap: assistedMode ? 3 : 1, flexWrap: 'wrap', justifyContent: 'center' }}>
                        {assistedMode ? (
                          <>
                            {[
                              { value: 'Da, intotdeauna', label: i18n.language === 'en' ? 'Yes, always' : 'Da, întotdeauna', emoji: '✓✓', rating: 2, color: 'success' as const },
                              { value: 'Da, partial', label: i18n.language === 'en' ? 'Yes, partially' : 'Da, parțial', emoji: '~', rating: 1, color: 'warning' as const },
                              { value: 'Nu, niciodata', label: i18n.language === 'en' ? 'No, never' : 'Nu, niciodată', emoji: '✗', rating: 0, color: 'error' as const },
                            ].map(opt => (
                              <Button key={opt.value}
                                variant={answers[q.id]?.selectedOption === opt.value ? 'contained' : 'outlined'}
                                color={opt.color}
                                onClick={() => setAnswer(q.id, { selectedOption: opt.value, ratingValue: opt.rating })}
                                sx={{ fontSize: '1.2rem', py: 2.5, px: 3, minWidth: 160, minHeight: 80, borderRadius: 3, fontWeight: 600 }}
                              >
                                {opt.label}
                              </Button>
                            ))}
                          </>
                        ) : (
                          <ToggleButtonGroup
                            exclusive
                            value={answers[q.id]?.selectedOption || ''}
                            onChange={(_, v) => v && setAnswer(q.id, { selectedOption: v, ratingValue: v.includes('intotdeauna') ? 2 : v.includes('partial') || v.includes('uneori') ? 1 : 0 })}
                            size="medium">
                            <ToggleButton value="Da, intotdeauna">{i18n.language === 'en' ? 'Yes, always' : 'Da, intotdeauna'}</ToggleButton>
                            <ToggleButton value="Da, partial">{i18n.language === 'en' ? 'Yes, partially' : 'Da, partial'}</ToggleButton>
                            <ToggleButton value="Nu, niciodata">{i18n.language === 'en' ? 'No, never' : 'Nu, niciodata'}</ToggleButton>
                          </ToggleButtonGroup>
                        )}
                      </Box>
                    )}

                    {q.type === 'MultipleChoice' && (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: assistedMode ? 2 : 1 }}>
                        {options.map((opt, idx) => (
                          <Button key={idx}
                            variant={answers[q.id]?.selectedOption === opt ? 'contained' : 'outlined'}
                            onClick={() => setAnswer(q.id, { selectedOption: opt })}
                            sx={{
                              justifyContent: 'flex-start', textAlign: 'left',
                              fontSize: assistedMode ? '1.2rem' : '0.85rem',
                              py: assistedMode ? 2.5 : 1, px: assistedMode ? 3 : 2,
                              borderRadius: assistedMode ? 3 : 1,
                            }}>
                            {opt}
                          </Button>
                        ))}
                      </Box>
                    )}

                    {q.type === 'FreeText' && (
                      <Box>
                        <TextField
                          multiline rows={assistedMode ? 4 : 3} fullWidth
                          value={answers[q.id]?.textValue || ''}
                          onChange={e => setAnswer(q.id, { textValue: e.target.value })}
                          placeholder={assistedMode ? (i18n.language === 'en' ? 'Type or use the microphone...' : 'Scrieti sau folositi microfonul...') : ''}
                          sx={{ '& .MuiInputBase-input': { fontSize: assistedMode ? '1.3rem' : fontSize } }}
                        />
                        {assistedMode && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2 }}>
                            <Button
                              variant={isListening ? 'contained' : 'outlined'}
                              color={isListening ? 'error' : 'primary'}
                              startIcon={isListening ? <MicOff /> : <Mic />}
                              onClick={() => isListening ? stopListening() : startListening(q.id)}
                              sx={{ fontSize: '1.1rem', py: 1.5, px: 3, borderRadius: 3 }}
                            >
                              {isListening
                                ? (i18n.language === 'en' ? 'Stop Recording' : 'Oprește Înregistrarea')
                                : (i18n.language === 'en' ? 'Speak Answer' : 'Dictează Răspunsul')}
                            </Button>
                            {isListening && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: 'error.main', animation: 'pulse 1s infinite' }} />
                                <Typography variant="body2" color="error">
                                  {i18n.language === 'en' ? 'Listening...' : 'Ascult...'}
                                </Typography>
                              </Box>
                            )}
                          </Box>
                        )}
                      </Box>
                    )}
                  </Box>
                );
              })}

              {/* Assisted mode: intra-step navigation (one question at a time) */}
              {assistedMode && currentQuestions.length > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3, mt: 2 }}>
                  <Button
                    variant="outlined"
                    startIcon={<NavigateBefore />}
                    disabled={assistedQIdx === 0}
                    onClick={() => setAssistedQIdx(i => i - 1)}
                    sx={{ fontSize: '1.1rem', py: 1.5, px: 3 }}
                  >
                    {i18n.language === 'en' ? 'Previous' : 'Precedenta'}
                  </Button>
                  <Button
                    variant="contained"
                    endIcon={<NavigateNext />}
                    disabled={assistedQIdx >= currentQuestions.length - 1}
                    onClick={() => setAssistedQIdx(i => i + 1)}
                    sx={{ fontSize: '1.1rem', py: 1.5, px: 3 }}
                  >
                    {i18n.language === 'en' ? 'Next Question' : 'Întrebarea Următoare'}
                  </Button>
                </Box>
              )}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
        <Button onClick={() => setActiveStep(s => s - 1)} disabled={activeStep === 0} variant="outlined">
          {t('feedback.back')}
        </Button>
        {activeStep < steps.length - 1 ? (
          <Button onClick={() => setActiveStep(s => s + 1)} variant="contained">
            {t('feedback.next')}
          </Button>
        ) : (
          <Button onClick={handleSubmit} variant="contained" color="success" size="large">
            {t('feedback.submit')}
          </Button>
        )}
      </Box>

      </>)}
    </Container>
  );
}
