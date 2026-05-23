import { useEffect, useState } from 'react';
import {
  Container, Typography, Box, Button, Grid, TextField,
  Select, MenuItem, FormControl, InputLabel, Dialog, DialogTitle,
  DialogContent, DialogActions, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, IconButton, Chip,
  Card, CardContent, Switch, FormControlLabel, Alert,
} from '@mui/material';
import { Add, Edit, AutoAwesome } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

interface Hospital {
  id: number; name: string; nameEN: string; address: string; city: string;
  county: string; type: string; totalBeds: number; totalDoctors: number;
  totalNurses: number; latitude: number; longitude: number;
}

const hospitalTypes = ['General', 'Emergency', 'Specialized', 'Pediatric', 'Oncologic',
  'Cardiac', 'Rehabilitation', 'Pneumology', 'Infectious', 'Psychiatry', 'Municipal', 'University', 'Military'];

export default function AdminPage() {
  const { t, i18n } = useTranslation();
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: '', nameEN: '', address: '', city: 'Cluj-Napoca', county: 'Cluj',
    type: 'General', totalBeds: 0, totalDoctors: 0, totalNurses: 0,
    latitude: 46.77, longitude: 23.59, phone: '', email: '', website: '',
    description: '', descriptionEN: '', yearFounded: 2000,
  });

  // AI Settings state
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiModel, setAiModel] = useState('');
  const [aiHasKey, setAiHasKey] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [aiTestLoading, setAiTestLoading] = useState(false);

  useEffect(() => { loadHospitals(); loadAiSettings(); }, []);

  const loadHospitals = () => {
    api.get('/hospitals').then(res => setHospitals(res.data));
  };

  const loadAiSettings = () => {
    api.get('/ai/settings').then(res => {
      setAiEnabled(res.data.enabled === 'true' || res.data.enabled === true);
      setAiModel(res.data.model || '');
      setAiHasKey(res.data.hasApiKey || false);
    }).catch(() => {});
  };

  const toggleAi = async (enabled: boolean) => {
    setAiEnabled(enabled);
    await api.put('/ai/settings', { enabled, model: aiModel || undefined });
  };

  const testAiConnection = async () => {
    setAiTestLoading(true);
    setAiTestResult(null);
    try {
      const res = await api.post('/ai/test');
      setAiTestResult({ success: res.data.success, message: res.data.success ? 'Connection OK' : res.data.error });
    } catch (err: any) {
      setAiTestResult({ success: false, message: err.message || 'Connection failed' });
    }
    setAiTestLoading(false);
  };

  const openAdd = () => {
    setEditId(null);
    setForm({
      name: '', nameEN: '', address: '', city: 'Cluj-Napoca', county: 'Cluj',
      type: 'General', totalBeds: 0, totalDoctors: 0, totalNurses: 0,
      latitude: 46.77, longitude: 23.59, phone: '', email: '', website: '',
      description: '', descriptionEN: '', yearFounded: 2000,
    });
    setDialogOpen(true);
  };

  const openEdit = (h: Hospital) => {
    setEditId(h.id);
    setForm({ ...h, phone: '', email: '', website: '', description: '', descriptionEN: '', yearFounded: 2000 });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const typeIndex = hospitalTypes.indexOf(form.type);
    const payload = { ...form, type: typeIndex >= 0 ? typeIndex : 0 };

    if (editId) {
      await api.put(`/hospitals/${editId}`, { ...payload, isActive: true });
    } else {
      await api.post('/hospitals', payload);
    }
    setDialogOpen(false);
    loadHospitals();
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" sx={{ mb: 4 }}>{t('admin.title')}</Typography>

      {/* AI Settings */}
      <Card sx={{ mb: 4, border: '1px solid', borderColor: aiEnabled ? 'primary.light' : 'divider' }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <AutoAwesome sx={{ color: '#7c3aed' }} />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {t('admin.aiSettings')}
            </Typography>
            <Chip
              size="small"
              label={aiEnabled ? (i18n.language === 'ro' ? 'ACTIV' : 'ACTIVE') : (i18n.language === 'ro' ? 'INACTIV' : 'INACTIVE')}
              color={aiEnabled ? 'success' : 'default'}
              sx={{ ml: 'auto' }}
            />
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
            <FormControlLabel
              control={<Switch checked={aiEnabled} onChange={(_, v) => toggleAi(v)} color="primary" />}
              label={i18n.language === 'ro' ? 'Activează AI pentru verificarea simptomelor' : 'Enable AI for symptom checking'}
            />

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" color="text.secondary">Model:</Typography>
              <Chip size="small" label={aiModel || 'N/A'} variant="outlined" />
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" color="text.secondary">API Key:</Typography>
              <Chip
                size="small"
                label={aiHasKey ? '••••••••' : (i18n.language === 'ro' ? 'Nesetat' : 'Not set')}
                color={aiHasKey ? 'success' : 'error'}
                variant="outlined"
              />
            </Box>

            <Button
              variant="outlined"
              size="small"
              onClick={testAiConnection}
              disabled={aiTestLoading}
            >
              {aiTestLoading ? '...' : (i18n.language === 'ro' ? 'Testează Conexiunea' : 'Test Connection')}
            </Button>
          </Box>

          {aiTestResult && (
            <Alert severity={aiTestResult.success ? 'success' : 'error'} sx={{ mt: 2 }}>
              {aiTestResult.message}
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Hospitals Table */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">{i18n.language === 'ro' ? 'Spitale' : 'Hospitals'}</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={openAdd}>
          {t('admin.addHospital')}
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell><strong>{t('admin.name')}</strong></TableCell>
              <TableCell><strong>{t('admin.type')}</strong></TableCell>
              <TableCell align="center"><strong>{t('admin.beds')}</strong></TableCell>
              <TableCell align="center"><strong>{t('admin.doctors')}</strong></TableCell>
              <TableCell align="center"><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {hospitals.map(h => (
              <TableRow key={h.id} hover>
                <TableCell>{h.name}</TableCell>
                <TableCell><Chip size="small" label={t(`hospitalTypes.${h.type}`)} /></TableCell>
                <TableCell align="center">{h.totalBeds}</TableCell>
                <TableCell align="center">{h.totalDoctors}</TableCell>
                <TableCell align="center">
                  <IconButton onClick={() => openEdit(h)} size="small"><Edit /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editId ? t('admin.editHospital') : t('admin.addHospital')}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth label={t('admin.name')} value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth label={t('admin.nameEN')} value={form.nameEN}
                onChange={e => setForm(f => ({ ...f, nameEN: e.target.value }))} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth label={t('admin.address')} value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            </Grid>
            <Grid size={{ xs: 6, md: 4 }}>
              <TextField fullWidth label={t('admin.city')} value={form.city}
                onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
            </Grid>
            <Grid size={{ xs: 6, md: 4 }}>
              <TextField fullWidth label={t('admin.county')} value={form.county}
                onChange={e => setForm(f => ({ ...f, county: e.target.value }))} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormControl fullWidth>
                <InputLabel>{t('admin.type')}</InputLabel>
                <Select value={form.type} label={t('admin.type')} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  {hospitalTypes.map(type => <MenuItem key={type} value={type}>{t(`hospitalTypes.${type}`)}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 4 }}>
              <TextField fullWidth type="number" label={t('admin.beds')} value={form.totalBeds}
                onChange={e => setForm(f => ({ ...f, totalBeds: parseInt(e.target.value) || 0 }))} />
            </Grid>
            <Grid size={{ xs: 4 }}>
              <TextField fullWidth type="number" label={t('admin.doctors')} value={form.totalDoctors}
                onChange={e => setForm(f => ({ ...f, totalDoctors: parseInt(e.target.value) || 0 }))} />
            </Grid>
            <Grid size={{ xs: 4 }}>
              <TextField fullWidth type="number" label={t('admin.nurses')} value={form.totalNurses}
                onChange={e => setForm(f => ({ ...f, totalNurses: parseInt(e.target.value) || 0 }))} />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField fullWidth type="number" label={t('admin.latitude')} value={form.latitude}
                onChange={e => setForm(f => ({ ...f, latitude: parseFloat(e.target.value) || 0 }))} slotProps={{ htmlInput: { step: 0.001 } }} />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField fullWidth type="number" label={t('admin.longitude')} value={form.longitude}
                onChange={e => setForm(f => ({ ...f, longitude: parseFloat(e.target.value) || 0 }))} slotProps={{ htmlInput: { step: 0.001 } }} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>{t('admin.cancel')}</Button>
          <Button variant="contained" onClick={handleSave}>{t('admin.save')}</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
