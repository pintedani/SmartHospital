import { useState, useEffect } from 'react';
import {
  Container, Typography, Box, Button, Chip, Card, CardContent,
  Grid, Alert, CircularProgress, Divider, Link as MuiLink, TextField, InputAdornment,
} from '@mui/material';
import {
  LocalHospital, Warning, Phone, Language, LocationOn,
  Star, ArrowForward, MyLocation, Search, AutoAwesome,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import AiBadge from '../components/AiBadge';

interface SymptomItem { id: string; nameEN: string; nameRO: string; }
interface SymptomCategory { category: string; categoryRO: string; symptoms: SymptomItem[]; }
interface MatchedDept { id: number; name: string; nameEN: string; specialty: string; }
interface HospitalRec {
  id: number; name: string; nameEN: string; address: string; city: string;
  type: string; website: string | null; phone: string | null;
  latitude: number; longitude: number; distance: number | null;
  averageRating: number | null; feedbackCount: number; score: number;
  matchedDepartments: MatchedDept[];
}
interface RecommendationResult {
  urgency: number; urgencyMessage: string;
  matchedSpecialties: string[]; hospitals: HospitalRec[];
  aiExplanation?: string; aiExplanationRO?: string;
  isAiGenerated?: boolean;
  followUpQuestions?: string[]; followUpQuestionsRO?: string[];
}

export default function SymptomCheckerPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<SymptomCategory[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<RecommendationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingSymptoms, setLoadingSymptoms] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [searchText, setSearchText] = useState('');
  const [freeText, setFreeText] = useState('');
  const [aiEnabled, setAiEnabled] = useState(false);

  const isRO = i18n.language === 'ro';

  // Check AI status
  useEffect(() => {
    api.get('/ai/status').then(res => setAiEnabled(res.data.enabled)).catch(() => {});
  }, []);

  // Load symptoms on first render
  useState(() => {
    setLoadingSymptoms(true);
    api.get('/recommendations/symptoms').then(res => {
      setCategories(res.data);
      setLoadingSymptoms(false);
    }).catch(() => setLoadingSymptoms(false));
  });

  const toggleSymptom = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const getLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      });
    }
  };

  const getRecommendations = async () => {
    if (selected.size === 0 && !freeText.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const symptoms = Array.from(selected).map(id => id.replace(/_/g, ' '));
      const hasFreeText = !!freeText.trim();
      if (hasFreeText) {
        console.log('%c[AI] >>> Sending request with free-text to LLM', 'color: #7c3aed; font-weight: bold', {
          symptoms,
          freeText: freeText.trim(),
        });
      } else {
        console.log('[Symptom Checker] Rule-based only (no free-text)', { symptoms });
      }
      const res = await api.post('/recommendations', {
        symptoms,
        latitude: userLocation?.lat,
        longitude: userLocation?.lng,
        freeText: freeText.trim() || undefined,
      });
      if (res.data.isAiGenerated) {
        console.log('%c[AI] <<< LLM Response received', 'color: #16a34a; font-weight: bold', {
          specialties: res.data.matchedSpecialties,
          urgency: res.data.urgencyMessage,
          explanation: res.data.aiExplanation,
          followUpQuestions: res.data.followUpQuestions,
        });
      } else {
        console.log('[Symptom Checker] Rule-based response', { specialties: res.data.matchedSpecialties });
      }
      setResult(res.data);
    } catch (err) {
      console.error('[AI] Error:', err);
    }
    setLoading(false);
  };

  const handleFollowUp = (question: string) => {
    setFreeText(prev => prev ? `${prev}. ${question}` : question);
  };

  const getUrgencyColor = (urgency: number) => {
    switch (urgency) {
      case 2: return 'error';
      case 1: return 'warning';
      default: return 'info';
    }
  };

  const getUrgencyLabel = (urgency: number) => {
    switch (urgency) {
      case 2: return isRO ? 'URGENTA' : 'EMERGENCY';
      case 1: return isRO ? 'URGENT' : 'URGENT';
      default: return isRO ? 'De rutina' : 'ROUTINE';
    }
  };

  const getName = (item: { name: string; nameEN: string }) =>
    isRO ? item.name : item.nameEN;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          <LocalHospital sx={{ mr: 1, verticalAlign: 'middle' }} />
          {t('symptoms.title')}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {t('symptoms.subtitle')}
        </Typography>
      </Box>

      <Alert severity="warning" sx={{ mb: 3 }}>
        {t('symptoms.disclaimer')}
      </Alert>

      {/* Location button */}
      <Box sx={{ mb: 3 }}>
        <Button
          variant="outlined"
          startIcon={<MyLocation />}
          onClick={getLocation}
          color={userLocation ? 'success' : 'primary'}
        >
          {userLocation
            ? (isRO ? 'Locatie detectata' : 'Location detected')
            : t('symptoms.useLocation')}
        </Button>
      </Box>

      {/* AI Free-text input (only visible when AI is enabled) */}
      {aiEnabled && (
        <Card sx={{ mb: 3, border: '1px solid', borderColor: 'primary.light', background: 'linear-gradient(135deg, rgba(124,58,237,0.03) 0%, rgba(37,99,235,0.03) 100%)' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <AutoAwesome sx={{ color: '#7c3aed', fontSize: 20 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {isRO ? 'Descrieți simptomele cu propriile cuvinte' : 'Describe your symptoms in your own words'}
              </Typography>
              <AiBadge />
            </Box>
            <TextField
              fullWidth
              multiline
              rows={3}
              value={freeText}
              onChange={e => setFreeText(e.target.value)}
              placeholder={isRO
                ? 'Ex: Am dureri de cap de 3 zile, amțeala și vederea încetoșată...'
                : 'Ex: I have had headaches for 3 days, dizziness and blurred vision...'}
              sx={{ '& .MuiInputBase-root': { borderRadius: 2 } }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              {isRO
                ? 'AI-ul va analiza descrierea și va identifica specialitățile potrivite. Nu includeți date personale (CNP, telefon, email).'
                : 'AI will analyze your description and identify relevant specialties. Do not include personal data (ID, phone, email).'}
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Search box */}
      <TextField
        fullWidth
        placeholder={isRO ? 'Cauta simptome...' : 'Search symptoms...'}
        value={searchText}
        onChange={e => setSearchText(e.target.value)}
        sx={{ mb: 3 }}
        slotProps={{
          input: { startAdornment: <InputAdornment position="start"><Search /></InputAdornment> },
        }}
      />

      {/* Symptom categories */}
      {loadingSymptoms ? (
        <CircularProgress />
      ) : (
        categories
          .map(cat => {
            const query = searchText.toLowerCase();
            const filtered = query
              ? cat.symptoms.filter(s =>
                  s.nameEN.toLowerCase().includes(query) ||
                  s.nameRO.toLowerCase().includes(query) ||
                  s.id.replace(/_/g, ' ').includes(query)
                )
              : cat.symptoms;
            if (filtered.length === 0) return null;
            return (
              <Box key={cat.category} sx={{ mb: 3 }}>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  {isRO ? cat.categoryRO : cat.category}
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {filtered.map(symptom => (
                    <Chip
                      key={symptom.id}
                      label={isRO ? symptom.nameRO : symptom.nameEN}
                      onClick={() => toggleSymptom(symptom.id)}
                      color={selected.has(symptom.id) ? 'primary' : 'default'}
                      variant={selected.has(symptom.id) ? 'filled' : 'outlined'}
                      sx={{
                        fontWeight: selected.has(symptom.id) ? 600 : 400,
                        transition: 'all 0.2s',
                      }}
                    />
                  ))}
                </Box>
              </Box>
            );
          })
          .filter(Boolean)
      )}

      {/* Action button */}
      <Box sx={{ mt: 4, mb: 4, textAlign: 'center' }}>
        <Button
          variant="contained"
          size="large"
          disabled={(selected.size === 0 && !freeText.trim()) || loading}
          onClick={getRecommendations}
          startIcon={loading ? <CircularProgress size={20} /> : (aiEnabled && freeText.trim() ? <AutoAwesome /> : <ArrowForward />)}
          sx={{ px: 5, py: 1.5 }}
        >
          {t('symptoms.getRecommendations')} {selected.size > 0 && `(${selected.size})`}
        </Button>
      </Box>

      {/* Results */}
      {result && (
        <Box sx={{ mt: 4 }}>
          <Divider sx={{ mb: 3 }} />

          {/* Urgency banner */}
          <Alert severity={getUrgencyColor(result.urgency) as any} sx={{ mb: 3 }} icon={<Warning />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {getUrgencyLabel(result.urgency)}
              </Typography>
              {result.isAiGenerated && <AiBadge />}
            </Box>
            <Typography variant="body2">{result.urgencyMessage}</Typography>
          </Alert>

          {/* AI Explanation card */}
          {result.isAiGenerated && result.aiExplanation && (
            <Card sx={{ mb: 3, border: '1px solid', borderColor: 'primary.light', background: 'linear-gradient(135deg, rgba(124,58,237,0.04) 0%, rgba(37,99,235,0.04) 100%)' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <AutoAwesome sx={{ color: '#7c3aed', fontSize: 18 }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#7c3aed' }}>
                    {isRO ? 'Analiză AI' : 'AI Analysis'}
                  </Typography>
                  <AiBadge />
                </Box>
                <Typography variant="body2">
                  {isRO ? (result.aiExplanationRO || result.aiExplanation) : result.aiExplanation}
                </Typography>
              </CardContent>
            </Card>
          )}

          {/* Follow-up questions */}
          {result.isAiGenerated && result.followUpQuestions && result.followUpQuestions.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                {isRO ? 'Întrebaţi suplimentare pentru o recomandare mai precisă:' : 'Follow-up questions for a more precise recommendation:'}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {(isRO ? (result.followUpQuestionsRO || result.followUpQuestions) : result.followUpQuestions).map((q, i) => (
                  <Chip
                    key={i}
                    label={q}
                    onClick={() => handleFollowUp(q)}
                    variant="outlined"
                    color="primary"
                    sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'primary.50' } }}
                  />
                ))}
              </Box>
            </Box>
          )}

          {/* Matched specialties */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              {t('symptoms.matchedSpecialties')}:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {result.matchedSpecialties.map(s => (
                <Chip key={s} label={s} size="small" color="secondary" variant="outlined" />
              ))}
            </Box>
          </Box>

          {/* Hospital recommendations */}
          <Typography variant="h5" sx={{ mb: 2 }}>{t('symptoms.recommendedHospitals')}</Typography>

          <Grid container spacing={3}>
            {result.hospitals.map((hospital, idx) => (
              <Grid size={{ xs: 12, md: 6 }} key={hospital.id}>
                <Card sx={{
                  height: '100%',
                  border: idx === 0 ? '2px solid' : '1px solid',
                  borderColor: idx === 0 ? 'primary.main' : 'divider',
                  position: 'relative',
                }}>
                  {idx === 0 && (
                    <Chip
                      label={isRO ? 'Recomandat #1' : 'Top Recommended'}
                      color="primary"
                      size="small"
                      sx={{ position: 'absolute', top: 12, right: 12 }}
                    />
                  )}
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      {getName(hospital)}
                    </Typography>

                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                      <Chip label={hospital.type} size="small" variant="outlined" />
                      {hospital.averageRating && (
                        <Chip
                          icon={<Star sx={{ fontSize: 16 }} />}
                          label={hospital.averageRating.toFixed(1)}
                          size="small"
                          color="warning"
                        />
                      )}
                      {hospital.distance !== null && (
                        <Chip
                          icon={<LocationOn sx={{ fontSize: 16 }} />}
                          label={`${hospital.distance} km`}
                          size="small"
                        />
                      )}
                    </Box>

                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      <LocationOn sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} />
                      {hospital.address}, {hospital.city}
                    </Typography>

                    {hospital.phone && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        <Phone sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} />
                        <MuiLink href={`tel:${hospital.phone}`}>{hospital.phone}</MuiLink>
                      </Typography>
                    )}

                    {hospital.website && (
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <Language sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} />
                        <MuiLink href={hospital.website} target="_blank" rel="noopener noreferrer">
                          {hospital.website.replace(/^https?:\/\//, '')}
                        </MuiLink>
                      </Typography>
                    )}

                    <Divider sx={{ my: 1.5 }} />

                    <Typography variant="subtitle2" gutterBottom>
                      {t('symptoms.matchingDepartments')}:
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
                      {hospital.matchedDepartments.map(d => (
                        <Chip key={d.id} label={getName(d)} size="small" color="success" variant="outlined" />
                      ))}
                    </Box>

                    <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => navigate(`/hospital/${hospital.id}`)}
                      >
                        {t('symptoms.viewHospital')}
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        color="success"
                        onClick={() => navigate(`/reservation/${hospital.id}`)}
                      >
                        {t('reservation.bookNow')}
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => navigate(`/feedback/${hospital.id}`)}
                      >
                        {t('symptoms.giveFeedback')}
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}
    </Container>
  );
}
