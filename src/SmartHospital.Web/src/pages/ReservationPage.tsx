import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Container, Typography, Stepper, Step, StepLabel, Box, TextField,
  Button, Card, CardContent, Alert, Chip, Grid, Paper,
  CircularProgress, Divider,
} from '@mui/material';
import {
  CalendarMonth, AccessTime, CheckCircle, Person, Phone, Email,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

interface Department {
  id: number;
  name: string;
  nameEN: string;
  specialty: string;
}

interface TimeSlot {
  time: string;
  available: number;
  maxCapacity: number;
  isFull: boolean;
}

interface ReservationResult {
  id: number;
  accessCode: string;
  status: string;
  appointmentDate: string;
  appointmentTime: string;
  hospitalName: string;
  departmentName: string;
}

export default function ReservationPage() {
  const { hospitalId } = useParams<{ hospitalId: string }>();
  const { t, i18n } = useTranslation();
  const [activeStep, setActiveStep] = useState(0);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState<number>(0);
  const [selectedDate, setSelectedDate] = useState('');
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selectedTime, setSelectedTime] = useState('');
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [patientEmail, setPatientEmail] = useState('');
  const [patientCNP, setPatientCNP] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [result, setResult] = useState<ReservationResult | null>(null);
  const [error, setError] = useState('');
  const [hospitalName, setHospitalName] = useState('');

  const steps = [
    t('reservation.stepDepartment'),
    t('reservation.stepDateTime'),
    t('reservation.stepPatientInfo'),
    t('reservation.stepConfirm'),
  ];

  useEffect(() => {
    if (hospitalId) {
      api.get(`/reservations/departments?hospitalId=${hospitalId}`).then(r => setDepartments(r.data));
      api.get(`/hospitals/${hospitalId}`).then(r => setHospitalName(i18n.language === 'en' ? (r.data.nameEN || r.data.name) : r.data.name));
    }
  }, [hospitalId, i18n.language]);

  useEffect(() => {
    if (selectedDept && selectedDate) {
      setSlotsLoading(true);
      api.get(`/reservations/slots?departmentId=${selectedDept}&date=${selectedDate}`)
        .then(r => setSlots(r.data))
        .finally(() => setSlotsLoading(false));
    }
  }, [selectedDept, selectedDate]);

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/reservations', {
        hospitalId: Number(hospitalId),
        departmentId: selectedDept,
        patientName,
        patientPhone,
        patientEmail: patientEmail || null,
        patientCNP: patientCNP || null,
        appointmentDate: selectedDate,
        appointmentTime: selectedTime,
        notes: notes || null,
      });
      setResult(res.data);
      setActiveStep(4);
    } catch (err: any) {
      setError(err.response?.data?.error || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const getMinDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  };

  const isWeekend = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.getDay() === 0 || d.getDay() === 6;
  };

  const canProceed = () => {
    switch (activeStep) {
      case 0: return selectedDept > 0;
      case 1: return selectedDate && selectedTime && !isWeekend(selectedDate);
      case 2: return patientName.trim() && patientPhone.trim();
      case 3: return true;
      default: return false;
    }
  };

  if (result) {
    return (
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Card elevation={3}>
          <CardContent sx={{ textAlign: 'center', py: 4 }}>
            <CheckCircle sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
            <Typography variant="h5" gutterBottom sx={{ fontWeight: 700 }}>
              {t('reservation.success')}
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              {t('reservation.successMessage')}
            </Typography>
            <Paper variant="outlined" sx={{ p: 2, my: 3, textAlign: 'left' }}>
              <Typography variant="body2" color="text.secondary">{t('reservation.hospital')}</Typography>
              <Typography sx={{ fontWeight: 600 }} gutterBottom>{result.hospitalName}</Typography>
              <Typography variant="body2" color="text.secondary">{t('reservation.department')}</Typography>
              <Typography sx={{ fontWeight: 600 }} gutterBottom>{result.departmentName}</Typography>
              <Typography variant="body2" color="text.secondary">{t('reservation.date')}</Typography>
              <Typography sx={{ fontWeight: 600 }} gutterBottom>{result.appointmentDate}</Typography>
              <Typography variant="body2" color="text.secondary">{t('reservation.time')}</Typography>
              <Typography sx={{ fontWeight: 600 }} gutterBottom>{result.appointmentTime}</Typography>
              <Divider sx={{ my: 1 }} />
              <Typography variant="body2" color="text.secondary">{t('reservation.accessCode')}</Typography>
              <Typography variant="h4" sx={{ fontWeight: 700 }} color="primary.main">{result.accessCode}</Typography>
              <Typography variant="caption" color="text.secondary">
                {t('reservation.accessCodeHint')}
              </Typography>
            </Paper>
            <Chip label={result.status} color="warning" />
          </CardContent>
        </Card>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" sx={{ fontWeight: 700 }} gutterBottom>
        {t('reservation.title')}
      </Typography>
      {hospitalName && (
        <Typography variant="h6" color="text.secondary" gutterBottom>
          {hospitalName}
        </Typography>
      )}

      <Stepper activeStep={activeStep} sx={{ mb: 4, mt: 2 }}>
        {steps.map((label) => (
          <Step key={label}><StepLabel>{label}</StepLabel></Step>
        ))}
      </Stepper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Step 0: Select Department */}
      {activeStep === 0 && (
        <Box>
          <Typography variant="h6" gutterBottom>{t('reservation.selectDepartment')}</Typography>
          <Grid container spacing={2}>
            {departments.map(dept => (
              <Grid size={{ xs: 12, sm: 6 }} key={dept.id}>
                <Card
                  elevation={selectedDept === dept.id ? 4 : 1}
                  sx={{
                    cursor: 'pointer',
                    border: selectedDept === dept.id ? '2px solid' : '1px solid #e0e0e0',
                    borderColor: selectedDept === dept.id ? 'primary.main' : '#e0e0e0',
                    transition: 'all 0.2s',
                  }}
                  onClick={() => setSelectedDept(dept.id)}
                >
                  <CardContent>
                    <Typography sx={{ fontWeight: 600 }}>
                      {i18n.language === 'en' ? (dept.nameEN || dept.name) : dept.name}
                    </Typography>
                    <Chip label={dept.specialty} size="small" sx={{ mt: 1 }} />
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Step 1: Select Date & Time */}
      {activeStep === 1 && (
        <Box>
          <Typography variant="h6" gutterBottom>{t('reservation.selectDateTime')}</Typography>
          <TextField
            type="date"
            label={t('reservation.date')}
            value={selectedDate}
            onChange={(e) => { setSelectedDate(e.target.value); setSelectedTime(''); }}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: getMinDate() } }}
            fullWidth
            sx={{ mb: 3 }}
          />
          {selectedDate && isWeekend(selectedDate) && (
            <Alert severity="warning" sx={{ mb: 2 }}>{t('reservation.weekendWarning')}</Alert>
          )}
          {slotsLoading && <CircularProgress size={24} />}
          {!slotsLoading && slots.length > 0 && (
            <>
              <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                {t('reservation.availableSlots')}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {slots.map(slot => (
                  <Chip
                    key={slot.time}
                    icon={<AccessTime />}
                    label={`${slot.time} (${slot.available}/${slot.maxCapacity})`}
                    color={selectedTime === slot.time ? 'primary' : slot.isFull ? 'default' : 'success'}
                    variant={selectedTime === slot.time ? 'filled' : 'outlined'}
                    disabled={slot.isFull}
                    onClick={() => !slot.isFull && setSelectedTime(slot.time)}
                    sx={{ cursor: slot.isFull ? 'not-allowed' : 'pointer' }}
                  />
                ))}
              </Box>
            </>
          )}
          {!slotsLoading && selectedDate && !isWeekend(selectedDate) && slots.length === 0 && (
            <Alert severity="info">{t('reservation.noSlots')}</Alert>
          )}
        </Box>
      )}

      {/* Step 2: Patient Info */}
      {activeStep === 2 && (
        <Box>
          <Typography variant="h6" gutterBottom>{t('reservation.patientInfo')}</Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12 }}>
              <TextField
                label={t('reservation.patientName')}
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                fullWidth required
                slotProps={{ input: { startAdornment: <Person sx={{ mr: 1, color: 'text.secondary' }} /> } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label={t('reservation.patientPhone')}
                value={patientPhone}
                onChange={(e) => setPatientPhone(e.target.value)}
                fullWidth required
                slotProps={{ input: { startAdornment: <Phone sx={{ mr: 1, color: 'text.secondary' }} /> } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label={t('reservation.patientEmail')}
                value={patientEmail}
                onChange={(e) => setPatientEmail(e.target.value)}
                fullWidth
                slotProps={{ input: { startAdornment: <Email sx={{ mr: 1, color: 'text.secondary' }} /> } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label={t('reservation.patientCNP')}
                value={patientCNP}
                onChange={(e) => setPatientCNP(e.target.value)}
                fullWidth
                helperText={t('reservation.cnpOptional')}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                label={t('reservation.notes')}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                fullWidth multiline rows={3}
              />
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Step 3: Confirmation */}
      {activeStep === 3 && (
        <Box>
          <Typography variant="h6" gutterBottom>{t('reservation.confirmTitle')}</Typography>
          <Paper variant="outlined" sx={{ p: 3 }}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}>
                <Typography variant="body2" color="text.secondary">{t('reservation.department')}</Typography>
                <Typography sx={{ fontWeight: 600 }}>
                  {departments.find(d => d.id === selectedDept)?.name}
                </Typography>
              </Grid>
              <Grid size={{ xs: 3 }}>
                <Typography variant="body2" color="text.secondary">{t('reservation.date')}</Typography>
                <Typography sx={{ fontWeight: 600 }}>{selectedDate}</Typography>
              </Grid>
              <Grid size={{ xs: 3 }}>
                <Typography variant="body2" color="text.secondary">{t('reservation.time')}</Typography>
                <Typography sx={{ fontWeight: 600 }}>{selectedTime}</Typography>
              </Grid>
              <Grid size={{ xs: 12 }}><Divider /></Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant="body2" color="text.secondary">{t('reservation.patientName')}</Typography>
                <Typography sx={{ fontWeight: 600 }}>{patientName}</Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant="body2" color="text.secondary">{t('reservation.patientPhone')}</Typography>
                <Typography sx={{ fontWeight: 600 }}>{patientPhone}</Typography>
              </Grid>
              {patientEmail && (
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">{t('reservation.patientEmail')}</Typography>
                  <Typography sx={{ fontWeight: 600 }}>{patientEmail}</Typography>
                </Grid>
              )}
              {notes && (
                <Grid size={{ xs: 12 }}>
                  <Typography variant="body2" color="text.secondary">{t('reservation.notes')}</Typography>
                  <Typography>{notes}</Typography>
                </Grid>
              )}
            </Grid>
          </Paper>
        </Box>
      )}

      {/* Navigation */}
      {activeStep < 4 && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
          <Button
            disabled={activeStep === 0}
            onClick={() => setActiveStep(s => s - 1)}
          >
            {t('feedback.back')}
          </Button>
          {activeStep < 3 ? (
            <Button
              variant="contained"
              disabled={!canProceed()}
              onClick={() => setActiveStep(s => s + 1)}
            >
              {t('feedback.next')}
            </Button>
          ) : (
            <Button
              variant="contained"
              color="success"
              disabled={loading}
              onClick={handleSubmit}
              startIcon={loading ? <CircularProgress size={16} /> : <CalendarMonth />}
            >
              {t('reservation.bookAppointment')}
            </Button>
          )}
        </Box>
      )}
    </Container>
  );
}
