import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Container, Grid, Card, CardContent, CardActions, Typography, TextField,
  Box, Chip, Button, MenuItem, Select, FormControl, InputLabel,
  InputAdornment, Rating, Skeleton,
} from '@mui/material';
import { Search, Hotel, MedicalServices, Feedback } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

interface Hospital {
  id: number;
  name: string;
  nameEN: string;
  city: string;
  county: string;
  type: string;
  totalBeds: number;
  totalDoctors: number;
  totalNurses: number;
  latitude: number;
  longitude: number;
  averageRating: number | null;
  feedbackCount: number;
}

const typeColors: Record<string, string> = {
  Emergency: '#d32f2f', General: '#1976d2', Specialized: '#7b1fa2',
  Pediatric: '#f57c00', Oncologic: '#c62828', Cardiac: '#ad1457',
  Rehabilitation: '#2e7d32', Pneumology: '#00838f', Infectious: '#e65100',
  Psychiatry: '#4527a0', Municipal: '#1565c0', University: '#283593', Military: '#37474f',
};

export default function HospitalListPage() {
  const { t, i18n } = useTranslation();
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sortBy, setSortBy] = useState('name');

  useEffect(() => {
    loadHospitals();
  }, [typeFilter, sortBy]);

  const loadHospitals = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { sortBy, desc: 'true' };
      if (typeFilter) params.type = typeFilter;
      const res = await api.get('/hospitals', { params });
      setHospitals(res.data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const filtered = hospitals.filter(h => {
    const name = i18n.language === 'en' && h.nameEN ? h.nameEN : h.name;
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const getName = (h: Hospital) => i18n.language === 'en' && h.nameEN ? h.nameEN : h.name;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 1 }}>
        {t('hospitals.title')}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        {t('app.description')}
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, mb: 4, flexWrap: 'wrap' }}>
        <TextField
          placeholder={t('hospitals.search')}
          size="small"
          value={search}
          onChange={e => setSearch(e.target.value)}
          sx={{ minWidth: 250 }}
          slotProps={{
            input: { startAdornment: <InputAdornment position="start"><Search /></InputAdornment> },
          }}
        />
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>{t('hospitals.filter')}</InputLabel>
          <Select value={typeFilter} label={t('hospitals.filter')} onChange={e => setTypeFilter(e.target.value)}>
            <MenuItem value="">{t('hospitals.allTypes')}</MenuItem>
            {Object.keys(typeColors).map(type => (
              <MenuItem key={type} value={type}>{t(`hospitalTypes.${type}`)}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>{t('hospitals.sort')}</InputLabel>
          <Select value={sortBy} label={t('hospitals.sort')} onChange={e => setSortBy(e.target.value)}>
            <MenuItem value="name">{t('admin.name')}</MenuItem>
            <MenuItem value="beds">{t('hospitals.beds')}</MenuItem>
            <MenuItem value="doctors">{t('hospitals.doctors')}</MenuItem>
            <MenuItem value="rating">{t('hospitals.rating')}</MenuItem>
            <MenuItem value="feedback">{t('hospitals.feedback')}</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {loading ? (
        <Grid container spacing={3}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={i}>
              <Skeleton variant="rounded" height={220} />
            </Grid>
          ))}
        </Grid>
      ) : filtered.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 8, textAlign: 'center' }}>
          {t('hospitals.noResults')}
        </Typography>
      ) : (
        <Grid container spacing={3}>
          {filtered.map(hospital => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={hospital.id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Chip
                      label={t(`hospitalTypes.${hospital.type}`)}
                      size="small"
                      sx={{ bgcolor: typeColors[hospital.type] || '#666', color: 'white', fontWeight: 600 }}
                    />
                    {hospital.averageRating && (
                      <Rating value={hospital.averageRating / 1.0} max={4} size="small" readOnly precision={0.1} />
                    )}
                  </Box>
                  <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600, mb: 1, lineHeight: 1.3 }}>
                    {getName(hospital)}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2, color: 'text.secondary', fontSize: '0.85rem', flexWrap: 'wrap' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Hotel fontSize="small" /> {hospital.totalBeds} {t('hospitals.beds')}
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <MedicalServices fontSize="small" /> {hospital.totalDoctors} {t('hospitals.doctors')}
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Feedback fontSize="small" /> {hospital.feedbackCount}
                    </Box>
                  </Box>
                </CardContent>
                <CardActions sx={{ px: 2, pb: 2, gap: 1 }}>
                  <Button component={Link} to={`/hospital/${hospital.id}`} size="small" variant="outlined">
                    {t('hospitals.viewDetails')}
                  </Button>
                  <Button component={Link} to={`/feedback/${hospital.id}`} size="small" variant="contained" color="secondary">
                    {t('hospitals.giveFeedback')}
                  </Button>
                  <Button component={Link} to={`/reservation/${hospital.id}`} size="small" variant="contained" color="success">
                    {t('reservation.bookNow')}
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  );
}
