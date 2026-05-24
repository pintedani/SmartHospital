import { useEffect, useState } from 'react';
import {
  Container, Typography, Box, Grid, Card, CardContent, Select, MenuItem,
  FormControl, InputLabel, Chip, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, CircularProgress, Dialog, DialogTitle,
  DialogContent, DialogActions, Divider, IconButton,
} from '@mui/material';
import { Warning, TrendingUp, People, Feedback, Visibility } from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

interface OverviewData {
  totalFeedback: number; averageSatisfaction: number;
  abuseAlerts: number; unreviewedAlerts: number;
  categoryScores: Record<string, number>; weeklyTrend: { label: string; value: number; count: number }[];
}

interface DeptComparison {
  departmentId: number; name: string; nameEN: string;
  averageSatisfaction: number; feedbackCount: number; categoryScores: Record<string, number>;
}

interface AbuseAlert {
  id: number; hospitalId: number; hospitalName: string; departmentId: number | null;
  departmentName: string | null; alertType: string; createdAt: string;
  isReviewed: boolean; reviewedBy: string | null; reviewedAt: string | null; notes: string | null;
}

interface Hospital { id: number; name: string; nameEN: string; }

export default function DashboardPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [selectedHospital, setSelectedHospital] = useState<number | null>(null);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [deptComparison, setDeptComparison] = useState<DeptComparison[]>([]);
  const [alerts, setAlerts] = useState<AbuseAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedbackDialog, setFeedbackDialog] = useState<any>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  useEffect(() => {
    api.get('/hospitals').then(res => {
      setHospitals(res.data);
      if (user?.hospitalId) {
        setSelectedHospital(user.hospitalId);
      } else {
        setSelectedHospital(0); // 0 = All hospitals
      }
    });
  }, []);

  useEffect(() => {
    if (selectedHospital === null) return;
    setLoading(true);
    Promise.all([
      api.get(`/analytics/overview/${selectedHospital}`),
      api.get(`/analytics/departments/${selectedHospital}`),
      api.get(`/analytics/alerts/${selectedHospital}`),
    ]).then(([ov, dc, al]) => {
      setOverview(ov.data);
      setDeptComparison(dc.data);
      setAlerts(al.data);
      setLoading(false);
    });
  }, [selectedHospital]);

  const reviewAlert = async (alertId: number) => {
    await api.put(`/analytics/alerts/${alertId}/review`, { notes: 'Reviewed by manager' });
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, isReviewed: true } : a));
  };

  const viewAlertFeedback = async (alertId: number) => {
    setFeedbackLoading(true);
    setFeedbackDialog(null);
    try {
      const res = await api.get(`/analytics/alerts/${alertId}/feedback`);
      setFeedbackDialog(res.data);
    } catch (err) {
      console.error(err);
    }
    setFeedbackLoading(false);
  };

  if (loading && selectedHospital !== null) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;

  const catData = overview ? Object.entries(overview.categoryScores).map(([key, val]) => ({ category: key, score: val })) : [];
  const radarData = deptComparison.map(d => ({ name: i18n.language === 'en' ? d.nameEN || d.name : d.name, score: d.averageSatisfaction, count: d.feedbackCount }));

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h4">{t('dashboard.title')}</Typography>
        {!user?.hospitalId && (
        <FormControl size="small" sx={{ minWidth: 300 }}>
          <InputLabel>{t('dashboard.selectHospital')}</InputLabel>
          <Select value={selectedHospital ?? ''} label={t('dashboard.selectHospital')} onChange={e => setSelectedHospital(Number(e.target.value))}>
            <MenuItem value={0}><strong>{i18n.language === 'ro' ? 'Toate spitalele' : 'All Hospitals'}</strong></MenuItem>
            {hospitals.map(h => (
              <MenuItem key={h.id} value={h.id}>{i18n.language === 'en' && h.nameEN ? h.nameEN : h.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
        )}
      </Box>

      {overview && (
        <>
          {/* KPI Cards */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid size={{ xs: 6, md: 3 }}>
              <Card><CardContent sx={{ textAlign: 'center' }}>
                <Feedback color="primary" sx={{ fontSize: 36 }} />
                <Typography variant="h4">{overview.totalFeedback}</Typography>
                <Typography color="text.secondary">{t('dashboard.totalFeedback')}</Typography>
              </CardContent></Card>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Card><CardContent sx={{ textAlign: 'center' }}>
                <TrendingUp color="success" sx={{ fontSize: 36 }} />
                <Typography variant="h4">{overview.averageSatisfaction.toFixed(1)}</Typography>
                <Typography color="text.secondary">{t('dashboard.avgSatisfaction')}</Typography>
              </CardContent></Card>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Card><CardContent sx={{ textAlign: 'center' }}>
                <Warning color="error" sx={{ fontSize: 36 }} />
                <Typography variant="h4">{overview.abuseAlerts}</Typography>
                <Typography color="text.secondary">{t('dashboard.abuseAlerts')}</Typography>
              </CardContent></Card>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Card><CardContent sx={{ textAlign: 'center' }}>
                <People color="warning" sx={{ fontSize: 36 }} />
                <Typography variant="h4">{overview.unreviewedAlerts}</Typography>
                <Typography color="text.secondary">{t('dashboard.unreviewedAlerts')}</Typography>
              </CardContent></Card>
            </Grid>
          </Grid>

          {/* Charts */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid size={{ xs: 12, md: 8 }}>
              <Card sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>{t('dashboard.weeklyTrend')}</Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={overview.weeklyTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" fontSize={11} />
                    <YAxis domain={[0, 4]} />
                    <Tooltip />
                    <Line type="monotone" dataKey="value" stroke="#1976d2" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Card sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>{t('dashboard.categoryScores')}</Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={catData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" domain={[0, 4]} />
                    <YAxis dataKey="category" type="category" width={120} fontSize={11} />
                    <Tooltip />
                    <Bar dataKey="score" fill="#4caf50" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </Grid>
          </Grid>

          {/* Department Comparison */}
          {radarData.length > 0 && (
            <Card sx={{ p: 3, mb: 4 }}>
              <Typography variant="h6" gutterBottom>{t('dashboard.departmentComparison')}</Typography>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={radarData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={10} angle={-30} textAnchor="end" height={80} />
                  <YAxis domain={[0, 4]} />
                  <Tooltip />
                  <Bar dataKey="score" fill="#1976d2" name="Avg Score" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Abuse Alerts */}
          <Card sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom color="error">{t('dashboard.alerts')}</Typography>
            {alerts.length === 0 ? (
              <Typography color="text.secondary">{t('dashboard.noAlerts')}</Typography>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Department</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {alerts.map(alert => (
                      <TableRow key={alert.id} sx={{ bgcolor: alert.isReviewed ? undefined : 'error.50', cursor: 'pointer' }}
                        onClick={() => viewAlertFeedback(alert.id)} hover>
                        <TableCell>{new Date(alert.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>{alert.departmentName || 'N/A'}</TableCell>
                        <TableCell>{alert.alertType}</TableCell>
                        <TableCell>
                          <Chip size="small"
                            label={alert.isReviewed ? t('dashboard.reviewed') : t('dashboard.pending')}
                            color={alert.isReviewed ? 'success' : 'error'} />
                        </TableCell>
                        <TableCell>
                          <IconButton size="small" onClick={(e) => { e.stopPropagation(); viewAlertFeedback(alert.id); }}>
                            <Visibility fontSize="small" />
                          </IconButton>
                          {!alert.isReviewed && (
                            <Button size="small" onClick={(e) => { e.stopPropagation(); reviewAlert(alert.id); }}>
                              {t('dashboard.markReviewed')}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Card>

          {/* Feedback Detail Dialog */}
          <Dialog open={feedbackDialog !== null || feedbackLoading} onClose={() => setFeedbackDialog(null)} maxWidth="md" fullWidth>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {i18n.language === 'ro' ? 'Chestionar Completat - Detalii Alerta' : 'Completed Questionnaire - Alert Details'}
              {feedbackDialog && (
                <Chip color="error" size="small" label={feedbackDialog.alertType} />
              )}
            </DialogTitle>
            <DialogContent dividers>
              {feedbackLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
              ) : feedbackDialog && (
                <Box>
                  {/* Patient Info */}
                  <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      {i18n.language === 'ro' ? 'Informatii Pacient' : 'Patient Information'}
                    </Typography>
                    <Typography variant="body2">
                      <strong>{i18n.language === 'ro' ? 'Spital' : 'Hospital'}:</strong> {feedbackDialog.hospitalName}
                    </Typography>
                    {feedbackDialog.departmentName && (
                      <Typography variant="body2">
                        <strong>{i18n.language === 'ro' ? 'Sectie' : 'Department'}:</strong> {feedbackDialog.departmentName}
                      </Typography>
                    )}
                    <Typography variant="body2">
                      <strong>{i18n.language === 'ro' ? 'Data' : 'Date'}:</strong> {new Date(feedbackDialog.submittedAt).toLocaleString()}
                    </Typography>
                    {feedbackDialog.patientGender && (
                      <Typography variant="body2">
                        <strong>{i18n.language === 'ro' ? 'Gen' : 'Gender'}:</strong> {feedbackDialog.patientGender}
                      </Typography>
                    )}
                    {feedbackDialog.patientAge && (
                      <Typography variant="body2">
                        <strong>{i18n.language === 'ro' ? 'Varsta' : 'Age'}:</strong> {feedbackDialog.patientAge}
                      </Typography>
                    )}
                    <Typography variant="body2">
                      <strong>{i18n.language === 'ro' ? 'Completat de' : 'Filled by'}:</strong> {feedbackDialog.filledBy}
                    </Typography>
                  </Box>

                  <Divider sx={{ mb: 2 }} />

                  {/* Answers */}
                  {feedbackDialog.answers.map((ans: any, idx: number) => (
                    <Box key={idx} sx={{
                      mb: 2, p: 2, borderRadius: 1,
                      bgcolor: ans.isCorruptionAlert ? 'error.50' : 'background.paper',
                      border: ans.isCorruptionAlert ? '1px solid' : '1px solid #e0e0e0',
                      borderColor: ans.isCorruptionAlert ? 'error.main' : '#e0e0e0',
                    }}>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                        [{ans.questionCategory}] {ans.questionType}
                        {ans.isCorruptionAlert && <Chip size="small" label="⚠ Alert" color="error" sx={{ ml: 1 }} />}
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 500, mb: 1 }}>
                        {i18n.language === 'en' ? ans.questionTextEN : ans.questionTextRO}
                      </Typography>
                      <Box sx={{ pl: 2, borderLeft: '3px solid', borderColor: ans.isCorruptionAlert ? 'error.main' : 'primary.main' }}>
                        {ans.ratingValue !== null && (
                          <Typography variant="body1">
                            <strong>{i18n.language === 'ro' ? 'Scor' : 'Rating'}:</strong> {ans.ratingValue}/4
                          </Typography>
                        )}
                        {ans.selectedOption && (
                          <Typography variant="body1">
                            <strong>{i18n.language === 'ro' ? 'Raspuns' : 'Answer'}:</strong> {ans.selectedOption}
                          </Typography>
                        )}
                        {ans.textValue && (
                          <Typography variant="body1" sx={{ fontStyle: 'italic' }}>
                            "{ans.textValue}"
                          </Typography>
                        )}
                        {!ans.ratingValue && !ans.selectedOption && !ans.textValue && (
                          <Typography variant="body2" color="text.secondary">
                            {i18n.language === 'ro' ? 'Fara raspuns' : 'No answer'}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setFeedbackDialog(null)}>
                {i18n.language === 'ro' ? 'Inchide' : 'Close'}
              </Button>
            </DialogActions>
          </Dialog>
        </>
      )}
    </Container>
  );
}
