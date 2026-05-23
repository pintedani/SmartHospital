import { useState } from 'react';
import {
  Container, Typography, TextField, Button, Card, CardContent,
  Box, Alert, Chip, Paper, Divider, CircularProgress,
} from '@mui/material';
import { Search, CheckCircle, Cancel, Schedule, EventBusy } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

interface ReservationInfo {
  id: number;
  accessCode: string;
  patientName: string;
  patientPhone: string;
  patientEmail?: string;
  appointmentDate: string;
  appointmentTime: string;
  status: string;
  notes?: string;
  cancellationReason?: string;
  createdAt: string;
  confirmedAt?: string;
  hospitalName: string;
  hospitalNameEN: string;
  departmentName: string;
  departmentNameEN: string;
}

const statusColors: Record<string, 'warning' | 'success' | 'error' | 'info' | 'default'> = {
  Pending: 'warning',
  Confirmed: 'success',
  Cancelled: 'error',
  Completed: 'info',
  NoShow: 'default',
};

const statusIcons: Record<string, React.ReactElement> = {
  Pending: <Schedule />,
  Confirmed: <CheckCircle />,
  Cancelled: <Cancel />,
  Completed: <CheckCircle />,
  NoShow: <EventBusy />,
};

export default function ReservationStatusPage() {
  const { t, i18n } = useTranslation();
  const [code, setCode] = useState('');
  const [reservation, setReservation] = useState<ReservationInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cancelled, setCancelled] = useState(false);

  const handleSearch = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError('');
    setReservation(null);
    try {
      const res = await api.get(`/reservations/status/${code.trim().toUpperCase()}`);
      setReservation(res.data);
    } catch {
      setError(t('reservation.notFound'));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!reservation) return;
    try {
      await api.put(`/reservations/${reservation.id}/cancel`, { reason: 'Cancelled by patient' });
      setCancelled(true);
      setReservation({ ...reservation, status: 'Cancelled' });
    } catch {
      setError(t('common.error'));
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Typography variant="h4" sx={{ fontWeight: 700 }} gutterBottom>
        {t('reservation.checkStatus')}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        {t('reservation.checkStatusDesc')}
      </Typography>

      <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
        <TextField
          label={t('reservation.accessCode')}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          fullWidth
          slotProps={{ htmlInput: { maxLength: 8, style: { letterSpacing: '2px', fontWeight: 700 } } }}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <Button
          variant="contained"
          onClick={handleSearch}
          disabled={loading || !code.trim()}
          sx={{ minWidth: 100 }}
        >
          {loading ? <CircularProgress size={20} /> : <Search />}
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {cancelled && <Alert severity="success" sx={{ mb: 2 }}>{t('reservation.cancelledSuccess')}</Alert>}

      {reservation && (
        <Card elevation={3}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {t('reservation.reservationDetails')}
              </Typography>
              <Chip
                icon={statusIcons[reservation.status]}
                label={t(`reservation.status_${reservation.status}`)}
                color={statusColors[reservation.status] || 'default'}
              />
            </Box>

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">{t('reservation.hospital')}</Typography>
              <Typography sx={{ fontWeight: 600 }} gutterBottom>
                {i18n.language === 'en' ? (reservation.hospitalNameEN || reservation.hospitalName) : reservation.hospitalName}
              </Typography>

              <Typography variant="body2" color="text.secondary">{t('reservation.department')}</Typography>
              <Typography sx={{ fontWeight: 600 }} gutterBottom>
                {i18n.language === 'en' ? (reservation.departmentNameEN || reservation.departmentName) : reservation.departmentName}
              </Typography>

              <Divider sx={{ my: 1 }} />

              <Typography variant="body2" color="text.secondary">{t('reservation.date')}</Typography>
              <Typography sx={{ fontWeight: 600 }} gutterBottom>{reservation.appointmentDate}</Typography>

              <Typography variant="body2" color="text.secondary">{t('reservation.time')}</Typography>
              <Typography sx={{ fontWeight: 600 }} gutterBottom>{reservation.appointmentTime}</Typography>

              <Divider sx={{ my: 1 }} />

              <Typography variant="body2" color="text.secondary">{t('reservation.patientName')}</Typography>
              <Typography sx={{ fontWeight: 600 }} gutterBottom>{reservation.patientName}</Typography>

              {reservation.notes && (
                <>
                  <Typography variant="body2" color="text.secondary">{t('reservation.notes')}</Typography>
                  <Typography gutterBottom>{reservation.notes}</Typography>
                </>
              )}

              {reservation.cancellationReason && (
                <>
                  <Typography variant="body2" color="text.secondary">{t('reservation.cancellationReason')}</Typography>
                  <Typography color="error">{reservation.cancellationReason}</Typography>
                </>
              )}

              {reservation.confirmedAt && (
                <>
                  <Typography variant="body2" color="text.secondary">{t('reservation.confirmedAt')}</Typography>
                  <Typography>{new Date(reservation.confirmedAt).toLocaleString()}</Typography>
                </>
              )}
            </Paper>

            {(reservation.status === 'Pending' || reservation.status === 'Confirmed') && !cancelled && (
              <Button
                variant="outlined"
                color="error"
                fullWidth
                sx={{ mt: 2 }}
                onClick={handleCancel}
                startIcon={<Cancel />}
              >
                {t('reservation.cancelReservation')}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </Container>
  );
}
