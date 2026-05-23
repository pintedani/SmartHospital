import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Container, Typography, Box, Grid, Card, CardContent, Chip, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Rating, Tab, Tabs, CircularProgress,
} from '@mui/material';
import { Hotel, MedicalServices, People, Download, QrCode2 } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import api from '../services/api';

interface Department {
  id: number; hospitalId: number; name: string; nameEN: string;
  specialty: string; floor: number | null; bedsCount: number;
  doctorsCount: number; nursesCount: number; averageRating: number | null; feedbackCount: number;
}

interface HospitalDetail {
  id: number; name: string; nameEN: string; address: string; city: string; county: string;
  phone: string | null; email: string | null; website: string | null; type: string;
  totalBeds: number; totalDoctors: number; totalNurses: number; yearFounded: number | null;
  latitude: number; longitude: number; description: string | null; descriptionEN: string | null;
  averageRating: number | null; feedbackCount: number; departments: Department[];
}

export default function HospitalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const [hospital, setHospital] = useState<HospitalDetail | null>(null);
  const [tab, setTab] = useState(0);
  const [showQR, setShowQR] = useState(false);

  useEffect(() => {
    if (id) api.get(`/hospitals/${id}`).then(res => setHospital(res.data));
  }, [id]);

  if (!hospital) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;

  const getName = () => i18n.language === 'en' && hospital.nameEN ? hospital.nameEN : hospital.name;
  const getDesc = () => i18n.language === 'en' && hospital.descriptionEN ? hospital.descriptionEN : hospital.description;
  const getDeptName = (d: Department) => i18n.language === 'en' && d.nameEN ? d.nameEN : d.name;

  const downloadReport = () => {
    window.open(`http://localhost:5000/api/analytics/report/${hospital.id}/pdf`, '_blank');
  };

  const exportCsv = () => {
    window.open(`http://localhost:5000/api/analytics/export/${hospital.id}/csv`, '_blank');
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Hero Section */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
          <Typography variant="h4">{getName()}</Typography>
          <Chip label={t(`hospitalTypes.${hospital.type}`)} color="primary" />
        </Box>
        <Typography color="text.secondary" sx={{ mb: 2 }}>{getDesc()}</Typography>
        <Typography variant="body2" color="text.secondary">
          {hospital.address}, {hospital.city}, {hospital.county}
          {hospital.phone && ` | ${hospital.phone}`}
        </Typography>
      </Box>

      {/* Key Stats */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {[
          { icon: <Hotel />, label: t('hospitals.beds'), value: hospital.totalBeds },
          { icon: <MedicalServices />, label: t('hospitals.doctors'), value: hospital.totalDoctors },
          { icon: <People />, label: t('hospitals.nurses'), value: hospital.totalNurses },
          { icon: null, label: t('hospitals.departments'), value: hospital.departments.length },
          { icon: null, label: t('hospitals.feedback'), value: hospital.feedbackCount },
        ].map((stat, i) => (
          <Grid size={{ xs: 6, sm: 4, md: 2.4 }} key={i}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h5" color="primary.main">{stat.value}</Typography>
                <Typography variant="body2" color="text.secondary">{stat.label}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Rating */}
      {hospital.averageRating && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <Rating value={hospital.averageRating} max={4} readOnly precision={0.1} size="large" />
          <Typography variant="h6">{hospital.averageRating.toFixed(1)} / 4.0</Typography>
          <Typography color="text.secondary">({hospital.feedbackCount} {t('hospitals.feedback')})</Typography>
        </Box>
      )}

      {/* Actions */}
      <Box sx={{ display: 'flex', gap: 2, mb: 4, flexWrap: 'wrap' }}>
        <Button component={Link} to={`/feedback/${hospital.id}`} variant="contained" color="secondary">
          {t('hospitals.giveFeedback')}
        </Button>
        <Button component={Link} to={`/reservation/${hospital.id}`} variant="contained" color="success">
          {t('reservation.bookNow')}
        </Button>
        <Button variant="outlined" startIcon={<Download />} onClick={downloadReport}>
          {t('detail.downloadReport')}
        </Button>
        <Button variant="outlined" onClick={exportCsv}>{t('detail.exportCsv')}</Button>
        <Button variant="outlined" startIcon={<QrCode2 />} onClick={() => setShowQR(!showQR)}>
          {t('detail.qrCode')}
        </Button>
      </Box>

      {showQR && (
        <Card sx={{ p: 3, mb: 4, display: 'inline-block' }}>
          <QRCodeSVG value={`${window.location.origin}/feedback/${hospital.id}`} size={200} />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
            Scan to give feedback
          </Typography>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label={t('detail.departments')} />
        <Tab label={t('detail.overview')} />
      </Tabs>

      {tab === 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>{t('admin.name')}</strong></TableCell>
                <TableCell align="center"><strong>{t('hospitals.beds')}</strong></TableCell>
                <TableCell align="center"><strong>{t('hospitals.doctors')}</strong></TableCell>
                <TableCell align="center"><strong>{t('hospitals.nurses')}</strong></TableCell>
                <TableCell align="center"><strong>{t('hospitals.rating')}</strong></TableCell>
                <TableCell align="center"><strong>{t('hospitals.feedback')}</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {hospital.departments.map(dept => (
                <TableRow key={dept.id} hover>
                  <TableCell>{getDeptName(dept)}</TableCell>
                  <TableCell align="center">{dept.bedsCount}</TableCell>
                  <TableCell align="center">{dept.doctorsCount}</TableCell>
                  <TableCell align="center">{dept.nursesCount}</TableCell>
                  <TableCell align="center">
                    {dept.averageRating ? <Rating value={dept.averageRating} max={4} size="small" readOnly precision={0.1} /> : '-'}
                  </TableCell>
                  <TableCell align="center">{dept.feedbackCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {tab === 1 && (
        <Card sx={{ p: 3 }}>
          <Grid container spacing={2}>
            {hospital.yearFounded && (
              <Grid size={{ xs: 6, md: 3 }}>
                <Typography variant="body2" color="text.secondary">{t('detail.founded')}</Typography>
                <Typography variant="h6">{hospital.yearFounded}</Typography>
              </Grid>
            )}
            {hospital.phone && (
              <Grid size={{ xs: 6, md: 3 }}>
                <Typography variant="body2" color="text.secondary">{t('detail.phone')}</Typography>
                <Typography>{hospital.phone}</Typography>
              </Grid>
            )}
            {hospital.email && (
              <Grid size={{ xs: 6, md: 3 }}>
                <Typography variant="body2" color="text.secondary">{t('detail.email')}</Typography>
                <Typography>{hospital.email}</Typography>
              </Grid>
            )}
            {hospital.website && (
              <Grid size={{ xs: 6, md: 3 }}>
                <Typography variant="body2" color="text.secondary">{t('detail.website')}</Typography>
                <Typography>{hospital.website}</Typography>
              </Grid>
            )}
          </Grid>
        </Card>
      )}
    </Container>
  );
}
