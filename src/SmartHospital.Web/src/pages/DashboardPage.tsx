import { useEffect, useState } from 'react';
import {
  Container, Typography, Box, Grid, Card, CardContent, Select, MenuItem,
  FormControl, InputLabel, Chip, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, CircularProgress, Dialog, DialogTitle,
  DialogContent, DialogActions, Divider, IconButton, Pagination,
} from '@mui/material';
import { Warning, TrendingUp, People, Feedback, Visibility, AutoAwesome, Refresh } from '@mui/icons-material';
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
  const [aiSummary, setAiSummary] = useState<any>(null);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [aiHistory, setAiHistory] = useState<any[]>([]);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [feedbacksPage, setFeedbacksPage] = useState(1);
  const [feedbacksTotalPages, setFeedbacksTotalPages] = useState(1);
  const [feedbacksTotal, setFeedbacksTotal] = useState(0);
  const [feedbacksLoading, setFeedbacksLoading] = useState(false);

  const regenerateAiSummary = async () => {
    if (selectedHospital === null) return;
    setAiSummaryLoading(true);
    try {
      const res = await api.post(`/ai/summary/${selectedHospital}/regenerate`);
      if (res.data.available) {
        setAiSummary(res.data);
        api.get(`/ai/summary-history/${selectedHospital}`).then(r => setAiHistory(r.data)).catch(() => {});
      } else {
        setAiSummary(null);
      }
    } catch {
      // ignore
    } finally {
      setAiSummaryLoading(false);
    }
  };

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

    // Fetch AI summary
    setAiSummaryLoading(true);
    api.get(`/ai/summary/${selectedHospital}`).then(res => {
      if (res.data.available) {
        setAiSummary(res.data);
        console.log('%c[AI] Summary loaded', 'color: #7c3aed; font-weight: bold', res.data);
      } else {
        setAiSummary(null);
      }
    }).catch(() => setAiSummary(null)).finally(() => setAiSummaryLoading(false));

    // Fetch AI history
    api.get(`/ai/summary-history/${selectedHospital}`).then(res => setAiHistory(res.data)).catch(() => {});

    // Fetch feedbacks (reset to page 1)
    setFeedbacksPage(1);
  }, [selectedHospital]);

  useEffect(() => {
    if (selectedHospital === null) return;
    setFeedbacksLoading(true);
    api.get(`/analytics/feedbacks/${selectedHospital}?page=${feedbacksPage}&pageSize=20`)
      .then(res => {
        setFeedbacks(res.data.items);
        setFeedbacksTotalPages(res.data.totalPages);
        setFeedbacksTotal(res.data.totalCount);
      })
      .catch(() => setFeedbacks([]))
      .finally(() => setFeedbacksLoading(false));
  }, [selectedHospital, feedbacksPage]);

  const reviewAlert = async (alertId: number) => {
    await api.put(`/analytics/alerts/${alertId}/review`, { notes: 'Reviewed by manager' });
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, isReviewed: true } : a));
  };

  const viewAlertFeedback = async (alertId: number) => {
    setFeedbackLoading(true);
    setFeedbackDialog(null);
    try {
      const [fbRes, aiRes] = await Promise.all([
        api.get(`/analytics/alerts/${alertId}/feedback`),
        api.get(`/ai/alert-analysis/${alertId}`).catch(() => ({ data: { available: false } })),
      ]);
      setFeedbackDialog({ ...fbRes.data, aiAnalysis: aiRes.data.available ? aiRes.data : null });
      if (aiRes.data.available) {
        console.log('%c[AI] Alert analysis loaded', 'color: #7c3aed; font-weight: bold', aiRes.data);
      }
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

          {/* AI Summary Card */}
          <Card sx={{ p: 3, mb: 4, border: '1px solid', borderColor: 'primary.light', background: 'linear-gradient(135deg, rgba(124,58,237,0.03) 0%, rgba(37,99,235,0.03) 100%)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <AutoAwesome sx={{ color: '#7c3aed' }} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {i18n.language === 'ro' ? 'Sumar AI - Feedback Luna Curentă' : 'AI Summary - Current Month Feedback'}
              </Typography>
              {aiSummaryLoading && <CircularProgress size={18} sx={{ ml: 1 }} />}
              <Box sx={{ ml: 'auto' }}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<Refresh />}
                  disabled={aiSummaryLoading}
                  onClick={regenerateAiSummary}
                  sx={{ borderColor: '#7c3aed', color: '#7c3aed', '&:hover': { borderColor: '#5b21b6', bgcolor: 'rgba(124,58,237,0.05)' } }}
                >
                  {i18n.language === 'ro' ? 'Regenerează' : 'Regenerate'}
                </Button>
              </Box>
            </Box>
            {aiSummary ? (
              <Box>
                {/* Sentiment & metadata badges */}
                {(() => {
                  const meta = aiSummary.metadataJson ? JSON.parse(aiSummary.metadataJson) : null;
                  return meta ? (
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                      {meta.sentiment && (
                        <Chip size="small"
                          color={meta.sentiment === 'positive' ? 'success' : meta.sentiment === 'negative' ? 'error' : 'warning'}
                          label={`Sentiment: ${meta.sentiment}`} />
                      )}
                      {meta.severity && (
                        <Chip size="small"
                          color={meta.severity === 'critical' ? 'error' : meta.severity === 'high' ? 'error' : meta.severity === 'medium' ? 'warning' : 'default'}
                          label={`Severitate: ${meta.severity}`} />
                      )}
                    </Box>
                  ) : null;
                })()}

                <Typography variant="body1" sx={{ whiteSpace: 'pre-line', mb: 2 }}>
                  {i18n.language === 'ro' ? aiSummary.contentRO : aiSummary.contentEN}
                </Typography>

                {/* Key Issues */}
                {(() => {
                  const meta = aiSummary.metadataJson ? JSON.parse(aiSummary.metadataJson) : null;
                  return meta?.keyIssues?.length > 0 ? (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                        {i18n.language === 'ro' ? '⚠️ Probleme cheie:' : '⚠️ Key Issues:'}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {meta.keyIssues.map((issue: string, idx: number) => (
                          <Chip key={idx} size="small" variant="outlined" color="warning" label={issue} />
                        ))}
                      </Box>
                    </Box>
                  ) : null;
                })()}

                {/* Corruption Alerts */}
                {(() => {
                  const meta = aiSummary.metadataJson ? JSON.parse(aiSummary.metadataJson) : null;
                  return meta?.corruptionAlerts && meta.corruptionAlerts !== 'Niciun caz identificat' && meta.corruptionAlerts !== 'No cases identified' ? (
                    <Box sx={{ mb: 2, p: 1.5, bgcolor: 'error.50', borderRadius: 1, border: '1px solid', borderColor: 'error.light' }}>
                      <Typography variant="subtitle2" sx={{ mb: 0.5, color: 'error.main' }}>
                        {i18n.language === 'ro' ? '🚨 Alerte integritate:' : '🚨 Integrity Alerts:'}
                      </Typography>
                      <Typography variant="body2">
                        {meta.corruptionAlerts}
                      </Typography>
                    </Box>
                  ) : null;
                })()}

                {/* Action Items */}
                {(() => {
                  const meta = aiSummary.metadataJson ? JSON.parse(aiSummary.metadataJson) : null;
                  return meta?.actionItems?.length > 0 ? (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                        {i18n.language === 'ro' ? '📋 Acțiuni recomandate:' : '📋 Recommended Actions:'}
                      </Typography>
                      {meta.actionItems.map((item: string, idx: number) => (
                        <Typography key={idx} variant="body2" sx={{ pl: 1, mb: 0.3 }}>• {item}</Typography>
                      ))}
                    </Box>
                  ) : null;
                })()}

                {/* Department Issues */}
                {(() => {
                  const meta = aiSummary.metadataJson ? JSON.parse(aiSummary.metadataJson) : null;
                  return meta?.departmentIssues?.length > 0 ? (
                    <Box sx={{ mb: 2, p: 2, bgcolor: 'rgba(25,118,210,0.04)', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        {i18n.language === 'ro' ? '🏥 Probleme identificate pe secții:' : '🏥 Issues by Department:'}
                      </Typography>
                      {meta.departmentIssues.map((dept: any, idx: number) => (
                        <Box key={idx} sx={{ mb: 1, pl: 1, borderLeft: '3px solid', borderColor: dept.rating && dept.rating < 2 ? 'error.main' : dept.rating && dept.rating < 3 ? 'warning.main' : 'success.main' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {dept.department}
                            </Typography>
                            {dept.rating && (
                              <Chip size="small" variant="outlined"
                                color={dept.rating < 2 ? 'error' : dept.rating < 3 ? 'warning' : 'success'}
                                label={`${Number(dept.rating).toFixed(1)}/4`} />
                            )}
                          </Box>
                          <Typography variant="body2" color="text.secondary">
                            {i18n.language === 'ro' ? dept.issueRO : dept.issueEN}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  ) : null;
                })()}

                {/* AI Interpretation Details */}
                {(() => {
                  const meta = aiSummary.metadataJson ? JSON.parse(aiSummary.metadataJson) : null;
                  if (!meta) return null;
                  return (
                    <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(124,58,237,0.04)', borderRadius: 1, border: '1px dashed', borderColor: 'divider' }}>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        {i18n.language === 'ro' ? '🔍 Detalii interpretare AI:' : '🔍 AI Interpretation Details:'}
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 4 }}>
                          <Typography variant="caption" color="text.secondary">
                            {i18n.language === 'ro' ? 'Sentiment general' : 'Overall Sentiment'}
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {meta.sentiment === 'positive' ? (i18n.language === 'ro' ? '😊 Pozitiv' : '😊 Positive') :
                             meta.sentiment === 'negative' ? (i18n.language === 'ro' ? '😞 Negativ' : '😞 Negative') :
                             (i18n.language === 'ro' ? '😐 Mixt' : '😐 Mixed')}
                          </Typography>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 4 }}>
                          <Typography variant="caption" color="text.secondary">
                            {i18n.language === 'ro' ? 'Feedback-uri analizate' : 'Feedback Analyzed'}
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {aiSummary.feedbackCount}
                          </Typography>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 4 }}>
                          <Typography variant="caption" color="text.secondary">
                            {i18n.language === 'ro' ? 'Probleme identificate' : 'Issues Identified'}
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {meta.keyIssues?.length || 0}
                          </Typography>
                        </Grid>
                      </Grid>
                      {meta.corruptionAlerts && meta.corruptionAlerts !== 'Niciun caz identificat' && meta.corruptionAlerts !== 'No cases identified' && (
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            {i18n.language === 'ro' ? 'Cazuri integritate' : 'Integrity Cases'}
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: 'error.main' }}>
                            {i18n.language === 'ro' ? 'Da - vezi alertele de mai sus' : 'Yes - see alerts above'}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  );
                })()}

                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <Chip size="small" variant="outlined" label={`${aiSummary.feedbackCount} feedback-uri analizate`} />
                  <Chip size="small" variant="outlined" label={`Generat: ${new Date(aiSummary.generatedAt).toLocaleString()}`} />
                  {aiSummary.generatedBy && <Chip size="small" variant="outlined" label={`De: ${aiSummary.generatedBy}`} />}
                </Box>
              </Box>
            ) : !aiSummaryLoading ? (
              <Typography variant="body2" color="text.secondary">
                {i18n.language === 'ro' ? 'AI-ul nu este activat sau nu există feedback suficient.' : 'AI is not enabled or insufficient feedback.'}
              </Typography>
            ) : null}

            {/* AI History */}
            {aiHistory.length > 1 && (
              <Box sx={{ mt: 3 }}>
                <Divider sx={{ mb: 2 }} />
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  {i18n.language === 'ro' ? 'Istoric Sumarizări AI' : 'AI Summary History'}
                </Typography>
                {aiHistory.slice(1, 6).map((h: any) => (
                  <Box key={h.id} sx={{ mb: 1, p: 1.5, bgcolor: 'grey.50', borderRadius: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(h.generatedAt).toLocaleString()} — {h.summaryType === 'alert_analysis' ? '🚨 Analiză alertă' : '📊 Sumar lunar'}
                        {h.generatedBy && ` (${h.generatedBy})`}
                      </Typography>
                      <Chip size="small" label={`${h.feedbackCount} fb`} variant="outlined" />
                    </Box>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      {(i18n.language === 'ro' ? h.contentRO : h.contentEN)?.substring(0, 150)}...
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Card>

          {/* All Feedbacks */}
          <Card sx={{ p: 3, mb: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                {i18n.language === 'ro' ? 'Toate feedback-urile' : 'All Feedbacks'}
                <Chip size="small" label={feedbacksTotal} sx={{ ml: 1 }} />
              </Typography>
              {feedbacksLoading && <CircularProgress size={20} />}
            </Box>
            {feedbacks.length === 0 && !feedbacksLoading ? (
              <Typography color="text.secondary">
                {i18n.language === 'ro' ? 'Nu există feedback-uri.' : 'No feedbacks found.'}
              </Typography>
            ) : (
              <>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>{i18n.language === 'ro' ? 'Data' : 'Date'}</TableCell>
                        <TableCell>{i18n.language === 'ro' ? 'Spital' : 'Hospital'}</TableCell>
                        <TableCell>{i18n.language === 'ro' ? 'Secție' : 'Department'}</TableCell>
                        <TableCell>{i18n.language === 'ro' ? 'Scor mediu' : 'Avg Rating'}</TableCell>
                        <TableCell>{i18n.language === 'ro' ? 'Completat de' : 'Filled by'}</TableCell>
                        <TableCell>{i18n.language === 'ro' ? 'Răspunsuri' : 'Answers'}</TableCell>
                        <TableCell>{i18n.language === 'ro' ? 'Alertă' : 'Alert'}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {feedbacks.map((fb: any) => (
                        <TableRow key={fb.id} hover sx={{ bgcolor: fb.hasAlert ? 'error.50' : undefined }}>
                          <TableCell>{new Date(fb.submittedAt).toLocaleDateString()}</TableCell>
                          <TableCell>{fb.hospitalName}</TableCell>
                          <TableCell>{fb.departmentName || '—'}</TableCell>
                          <TableCell>
                            <Chip size="small" variant="outlined"
                              color={fb.averageRating >= 3 ? 'success' : fb.averageRating >= 2 ? 'warning' : 'error'}
                              label={fb.averageRating.toFixed(1)} />
                          </TableCell>
                          <TableCell>{fb.filledBy}{fb.isAnonymous ? ' 🕶️' : ''}</TableCell>
                          <TableCell>{fb.answerCount}</TableCell>
                          <TableCell>{fb.hasAlert ? <Warning color="error" fontSize="small" /> : '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                {feedbacksTotalPages > 1 && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                    <Pagination
                      count={feedbacksTotalPages}
                      page={feedbacksPage}
                      onChange={(_, p) => setFeedbacksPage(p)}
                      color="primary"
                    />
                  </Box>
                )}
              </>
            )}
          </Card>

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
                  {/* AI Analysis */}
                  {feedbackDialog.aiAnalysis && (
                    <Box sx={{ mb: 3, p: 2, borderRadius: 1, border: '1px solid', borderColor: 'primary.light', background: 'linear-gradient(135deg, rgba(124,58,237,0.05) 0%, rgba(37,99,235,0.05) 100%)' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <AutoAwesome sx={{ color: '#7c3aed', fontSize: 18 }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                          {i18n.language === 'ro' ? 'Analiză AI' : 'AI Analysis'}
                        </Typography>
                        {(() => {
                          const meta = feedbackDialog.aiAnalysis.metadataJson ? JSON.parse(feedbackDialog.aiAnalysis.metadataJson) : null;
                          return meta?.severity ? (
                            <Chip size="small"
                              color={meta.severity === 'critical' || meta.severity === 'high' ? 'error' : meta.severity === 'medium' ? 'warning' : 'default'}
                              label={meta.severity.toUpperCase()} sx={{ ml: 'auto' }} />
                          ) : null;
                        })()}
                      </Box>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                        {i18n.language === 'ro' ? feedbackDialog.aiAnalysis.contentRO : feedbackDialog.aiAnalysis.contentEN}
                      </Typography>
                      {(() => {
                        const meta = feedbackDialog.aiAnalysis.metadataJson ? JSON.parse(feedbackDialog.aiAnalysis.metadataJson) : null;
                        return meta?.actionItems?.length > 0 ? (
                          <Box sx={{ mt: 1.5, p: 1.5, bgcolor: 'rgba(124,58,237,0.05)', borderRadius: 1 }}>
                            <Typography variant="caption" sx={{ fontWeight: 600 }}>
                              {i18n.language === 'ro' ? 'Acțiuni recomandate:' : 'Recommended actions:'}
                            </Typography>
                            {meta.actionItems.map((item: string, idx: number) => (
                              <Typography key={idx} variant="body2" sx={{ pl: 1 }}>• {item}</Typography>
                            ))}
                          </Box>
                        ) : null;
                      })()}
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                        {i18n.language === 'ro' ? 'Generat' : 'Generated'}: {new Date(feedbackDialog.aiAnalysis.generatedAt).toLocaleString()}
                      </Typography>
                    </Box>
                  )}

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
