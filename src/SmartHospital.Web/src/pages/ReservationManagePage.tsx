import { useState, useEffect } from 'react';
import {
  Container, Typography, Box, TextField, MenuItem, Card, CardContent,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Chip, IconButton, Tooltip, Alert, Grid, CircularProgress,
} from '@mui/material';
import {
  CheckCircle, Cancel, EventBusy, Refresh,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface Reservation {
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
  departmentName: string;
  departmentSpecialty: string;
}

interface Stats {
  total: number;
  pending: number;
  confirmed: number;
  todayCount: number;
  upcoming: number;
}

const statusColors: Record<string, 'warning' | 'success' | 'error' | 'info' | 'default'> = {
  Pending: 'warning',
  Confirmed: 'success',
  Cancelled: 'error',
  Completed: 'info',
  NoShow: 'default',
};

export default function ReservationManagePage() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [hospitalId, setHospitalId] = useState(0);
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/hospitals').then(r => setHospitals(r.data));
  }, []);

  const fetchData = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (hospitalId > 0) params.append('hospitalId', String(hospitalId));
    if (dateFilter) params.append('date', dateFilter);
    if (statusFilter) params.append('status', statusFilter);

    Promise.all([
      api.get(`/reservations/manage?${params}`),
      api.get(`/reservations/stats?hospitalId=${hospitalId}`),
    ]).then(([resData, statsData]) => {
      setReservations(resData.data);
      setStats(statsData.data);
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isAuthenticated) fetchData();
  }, [isAuthenticated, hospitalId, dateFilter, statusFilter]);

  const handleAction = async (id: number, action: string) => {
    await api.put(`/reservations/${id}/${action}`);
    fetchData();
  };

  if (!isAuthenticated) {
    return (
      <Container sx={{ py: 4 }}>
        <Alert severity="warning">{t('reservation.loginRequired')}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          {t('reservation.management')}
        </Typography>
        <IconButton onClick={fetchData}><Refresh /></IconButton>
      </Box>

      {/* Stats */}
      {stats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {[
            { label: t('reservation.statTotal'), value: stats.total, color: '#1976d2' },
            { label: t('reservation.statPending'), value: stats.pending, color: '#ed6c02' },
            { label: t('reservation.statConfirmed'), value: stats.confirmed, color: '#2e7d32' },
            { label: t('reservation.statToday'), value: stats.todayCount, color: '#9c27b0' },
            { label: t('reservation.statUpcoming'), value: stats.upcoming, color: '#0288d1' },
          ].map(s => (
            <Grid size={{ xs: 6, sm: 2.4 }} key={s.label}>
              <Card>
                <CardContent sx={{ textAlign: 'center', py: 2 }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: s.color }}>{s.value}</Typography>
                  <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <TextField
          select label={t('reservation.hospital')} value={hospitalId}
          onChange={(e) => setHospitalId(Number(e.target.value))}
          sx={{ minWidth: 200 }}
        >
          <MenuItem value={0}>{t('reservation.allHospitals')}</MenuItem>
          {hospitals.map((h: any) => <MenuItem key={h.id} value={h.id}>{h.name}</MenuItem>)}
        </TextField>
        <TextField
          type="date" label={t('reservation.date')} value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ minWidth: 160 }}
        />
        <TextField
          select label={t('reservation.statusFilter')} value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          sx={{ minWidth: 150 }}
        >
          <MenuItem value="">{t('reservation.allStatuses')}</MenuItem>
          <MenuItem value="Pending">{t('reservation.status_Pending')}</MenuItem>
          <MenuItem value="Confirmed">{t('reservation.status_Confirmed')}</MenuItem>
          <MenuItem value="Cancelled">{t('reservation.status_Cancelled')}</MenuItem>
          <MenuItem value="Completed">{t('reservation.status_Completed')}</MenuItem>
          <MenuItem value="NoShow">{t('reservation.status_NoShow')}</MenuItem>
        </TextField>
      </Box>

      {loading && <CircularProgress />}

      {/* Table */}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('reservation.accessCode')}</TableCell>
              <TableCell>{t('reservation.patientName')}</TableCell>
              <TableCell>{t('reservation.patientPhone')}</TableCell>
              <TableCell>{t('reservation.hospital')}</TableCell>
              <TableCell>{t('reservation.department')}</TableCell>
              <TableCell>{t('reservation.date')}</TableCell>
              <TableCell>{t('reservation.time')}</TableCell>
              <TableCell>{t('reservation.statusFilter')}</TableCell>
              <TableCell>{t('reservation.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {reservations.map(r => (
              <TableRow key={r.id} hover>
                <TableCell><Typography variant="body2" sx={{ fontWeight: 700, fontFamily: 'monospace' }}>{r.accessCode}</Typography></TableCell>
                <TableCell>{r.patientName}</TableCell>
                <TableCell>{r.patientPhone}</TableCell>
                <TableCell>{r.hospitalName}</TableCell>
                <TableCell>{r.departmentName}</TableCell>
                <TableCell>{r.appointmentDate}</TableCell>
                <TableCell>{r.appointmentTime}</TableCell>
                <TableCell>
                  <Chip label={t(`reservation.status_${r.status}`)} color={statusColors[r.status] || 'default'} size="small" />
                </TableCell>
                <TableCell>
                  {r.status === 'Pending' && (
                    <>
                      <Tooltip title={t('reservation.confirm')}>
                        <IconButton color="success" size="small" onClick={() => handleAction(r.id, 'confirm')}>
                          <CheckCircle />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('reservation.cancel')}>
                        <IconButton color="error" size="small" onClick={() => handleAction(r.id, 'cancel')}>
                          <Cancel />
                        </IconButton>
                      </Tooltip>
                    </>
                  )}
                  {r.status === 'Confirmed' && (
                    <>
                      <Tooltip title={t('reservation.complete')}>
                        <IconButton color="info" size="small" onClick={() => handleAction(r.id, 'complete')}>
                          <CheckCircle />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('reservation.markNoShow')}>
                        <IconButton color="default" size="small" onClick={() => handleAction(r.id, 'noshow')}>
                          <EventBusy />
                        </IconButton>
                      </Tooltip>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {reservations.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={9} align="center">
                  <Typography color="text.secondary" sx={{ py: 2 }}>{t('reservation.noReservations')}</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  );
}
