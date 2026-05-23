import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  Container, Typography, Box, Button, Stepper, Step, StepLabel,
  Card, CardContent, ToggleButtonGroup, ToggleButton, TextField,
  MenuItem, Select, FormControl, InputLabel, Alert, Grow, Switch,
  FormControlLabel,
} from '@mui/material';
import { SentimentVeryDissatisfied, SentimentDissatisfied, SentimentSatisfied, SentimentVerySatisfied, CheckCircle } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
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

  const [questions, setQuestions] = useState<Question[]>([]);
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [hospitalName, setHospitalName] = useState('');
  const [steps, setSteps] = useState<number[]>([]);
  const [activeStep, setActiveStep] = useState(0);
  const [assistedMode, setAssistedMode] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Form state
  const [gender, setGender] = useState<string>('');
  const [age, setAge] = useState<string>('');
  const [departmentId, setDepartmentId] = useState<string>(deptParam || '');
  const [filledBy, setFilledBy] = useState<string>('Patient');
  const [answers, setAnswers] = useState<Record<number, { ratingValue?: number; textValue?: string; selectedOption?: string }>>({});

  useEffect(() => {
    if (hospitalId) {
      api.get(`/feedback/questionnaire/${hospitalId}`).then(res => {
        setQuestions(res.data.questions);
        setDepartments(res.data.departments);
        setHospitalName(i18n.language === 'en' ? res.data.hospitalNameEN || res.data.hospitalName : res.data.hospitalName);
        setSteps([0, ...res.data.wizardSteps]);
      });
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
      answers: feedbackAnswers,
    });

    setSubmitted(true);
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

      <FormControlLabel
        control={<Switch checked={assistedMode} onChange={(_, v) => setAssistedMode(v)} />}
        label={t('feedback.assistedMode')}
        sx={{ mb: 3 }}
      />

      <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4 }}>
        {steps.map((_, idx) => (
          <Step key={idx}><StepLabel>{!assistedMode && stepLabels[idx]}</StepLabel></Step>
        ))}
      </Stepper>

      <Card sx={{ minHeight: 300 }}>
        <CardContent sx={{ p: assistedMode ? 4 : 3 }}>
          {/* Step 0: Basic Info */}
          {activeStep === 0 && (
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
            </Box>
          )}

          {/* Question Steps */}
          {activeStep > 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {currentQuestions.map(q => {
                const text = i18n.language === 'en' ? q.textEN : q.textRO;
                const options = q.optionsJson ? JSON.parse(q.optionsJson) as string[] : [];

                return (
                  <Box key={q.id}>
                    <Typography sx={{ fontSize, fontWeight: 500, mb: 2 }}>
                      {text} {q.isRequired && <span style={{ color: 'red' }}>*</span>}
                    </Typography>

                    {q.isCorruptionAlert && (
                      <Alert severity="warning" sx={{ mb: 2 }}>
                        {i18n.language === 'en'
                          ? 'This question helps fight corruption. Your answer triggers an automatic alert.'
                          : 'Aceasta intrebare ajuta la combaterea coruptiei. Raspunsul dumneavoastra declanseaza o alerta automata.'}
                      </Alert>
                    )}

                    {q.type === 'Smiley' && (
                      <Box sx={{ display: 'flex', gap: assistedMode ? 3 : 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                        {[
                          { icon: <SentimentVerySatisfied />, label: options[0] || t('common.verySatisfied'), value: 4 },
                          { icon: <SentimentSatisfied />, label: options[1] || t('common.satisfied'), value: 3 },
                          { icon: <SentimentDissatisfied />, label: options[2] || t('common.dissatisfied'), value: 2 },
                          { icon: <SentimentVeryDissatisfied />, label: options[3] || t('common.veryDissatisfied'), value: 1 },
                        ].map(opt => (
                          <Button key={opt.value}
                            variant={answers[q.id]?.ratingValue === opt.value ? 'contained' : 'outlined'}
                            onClick={() => setAnswer(q.id, { ratingValue: opt.value, selectedOption: opt.label })}
                            sx={{ flexDirection: 'column', py: 2, px: 3, minWidth: assistedMode ? 120 : 90,
                              fontSize: assistedMode ? 40 : 30 }}>
                            {opt.icon}
                            <Typography variant="caption" sx={{ mt: 0.5, fontSize: assistedMode ? '0.9rem' : '0.7rem' }}>
                              {opt.label}
                            </Typography>
                          </Button>
                        ))}
                      </Box>
                    )}

                    {q.type === 'Rating' && (
                      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                        {options.map((opt, idx) => (
                          <Button key={idx}
                            variant={answers[q.id]?.selectedOption === opt ? 'contained' : 'outlined'}
                            color={idx === 0 ? 'success' : idx === 1 ? 'primary' : 'error'}
                            onClick={() => setAnswer(q.id, { ratingValue: options.length - idx, selectedOption: opt })}
                            sx={{ fontSize: assistedMode ? '1.1rem' : '0.9rem', py: assistedMode ? 2 : 1 }}>
                            {opt}
                          </Button>
                        ))}
                      </Box>
                    )}

                    {q.type === 'YesNo' && (
                      <ToggleButtonGroup
                        exclusive
                        value={answers[q.id]?.selectedOption || ''}
                        onChange={(_, v) => v && setAnswer(q.id, { selectedOption: v, ratingValue: v === 'Da' ? 1 : 0 })}
                        size={assistedMode ? 'large' : 'medium'}>
                        <ToggleButton value="Da" color={q.isCorruptionAlert ? 'error' : 'primary'}>
                          {t('common.yes')}
                        </ToggleButton>
                        <ToggleButton value="Nu" color="primary">{t('common.no')}</ToggleButton>
                      </ToggleButtonGroup>
                    )}

                    {q.type === 'YesPartialNo' && (
                      <ToggleButtonGroup
                        exclusive
                        value={answers[q.id]?.selectedOption || ''}
                        onChange={(_, v) => v && setAnswer(q.id, { selectedOption: v, ratingValue: v.includes('intotdeauna') ? 2 : v.includes('partial') || v.includes('uneori') ? 1 : 0 })}
                        size={assistedMode ? 'large' : 'medium'}>
                        <ToggleButton value="Da, intotdeauna">{i18n.language === 'en' ? 'Yes, always' : 'Da, intotdeauna'}</ToggleButton>
                        <ToggleButton value="Da, partial">{i18n.language === 'en' ? 'Yes, partially' : 'Da, partial'}</ToggleButton>
                        <ToggleButton value="Nu, niciodata">{i18n.language === 'en' ? 'No, never' : 'Nu, niciodata'}</ToggleButton>
                      </ToggleButtonGroup>
                    )}

                    {q.type === 'MultipleChoice' && (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {options.map((opt, idx) => (
                          <Button key={idx}
                            variant={answers[q.id]?.selectedOption === opt ? 'contained' : 'outlined'}
                            onClick={() => setAnswer(q.id, { selectedOption: opt })}
                            sx={{ justifyContent: 'flex-start', textAlign: 'left', fontSize: assistedMode ? '1rem' : '0.85rem' }}>
                            {opt}
                          </Button>
                        ))}
                      </Box>
                    )}

                    {q.type === 'FreeText' && (
                      <TextField
                        multiline rows={3} fullWidth
                        value={answers[q.id]?.textValue || ''}
                        onChange={e => setAnswer(q.id, { textValue: e.target.value })}
                        sx={{ '& .MuiInputBase-input': { fontSize } }}
                      />
                    )}
                  </Box>
                );
              })}
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
    </Container>
  );
}
