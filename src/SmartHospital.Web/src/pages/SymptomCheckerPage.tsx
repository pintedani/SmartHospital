import { useState } from 'react';
import {
  Container, Typography, Box, Button, Chip, Card, CardContent,
  Grid, Alert, CircularProgress, Divider, Link as MuiLink, TextField, InputAdornment,
} from '@mui/material';
import {
  LocalHospital, Warning, Phone, Language, LocationOn,
  Star, ArrowForward, MyLocation, Search,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

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

  const isRO = i18n.language === 'ro';

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
    if (selected.size === 0) return;
    setLoading(true);
    setResult(null);
    try {
      // Convert IDs back to symptom names (replace _ with space)
      const symptoms = Array.from(selected).map(id => id.replace(/_/g, ' '));
      const res = await api.post('/recommendations', {
        symptoms,
        latitude: userLocation?.lat,
        longitude: userLocation?.lng,
      });
      setResult(res.data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
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
          disabled={selected.size === 0 || loading}
          onClick={getRecommendations}
          startIcon={loading ? <CircularProgress size={20} /> : <ArrowForward />}
          sx={{ px: 5, py: 1.5 }}
        >
          {t('symptoms.getRecommendations')} ({selected.size})
        </Button>
      </Box>

      {/* Results */}
      {result && (
        <Box sx={{ mt: 4 }}>
          <Divider sx={{ mb: 3 }} />

          {/* Urgency banner */}
          <Alert severity={getUrgencyColor(result.urgency) as any} sx={{ mb: 3 }} icon={<Warning />}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              {getUrgencyLabel(result.urgency)}
            </Typography>
            <Typography variant="body2">{result.urgencyMessage}</Typography>
          </Alert>

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
