import { useEffect, useState } from 'react';
import {
  Container, Typography, Box, Grid, Card, CardContent, Select, MenuItem,
  FormControl, InputLabel, Chip, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, CircularProgress, Dialog, DialogTitle,
  DialogContent, DialogActions, Divider, IconButton, Pagination,
} from '@mui/material';
import { Warning, TrendingUp, TrendingDown, People, Feedback, Visibility, AutoAwesome, Refresh, Gavel, ArrowUpward } from '@mui/icons-material';
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
  const [trends, setTrends] = useState<any>(null);
  const [accountability, setAccountability] = useState<any>(null);

  const updateAlertStatus = async (alertId: number, status: string, notes?: string) => {
    await api.put(`/analytics/alerts/${alertId}/status`, { status, notes });
    // Refresh alerts
    const res = await api.get(`/analytics/alerts/${selectedHospital}`);
    setAlerts(res.data);
  };

  const escalateAlert = async (alertId: number) => {
    await api.put(`/analytics/alerts/${alertId}/escalate`);
    const res = await api.get(`/analytics/alerts/${selectedHospital}`);
    setAlerts(res.data);
  };

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

    // Fetch trends & accountability
    api.get(`/analytics/trends/${selectedHospital}`).then(res => setTrends(res.data)).catch(() => setTrends(null));
    api.get(`/analytics/accountability/${selectedHospital}`).then(res => setAccountability(res.data)).catch(() => setAccountability(null));

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
                      {meta.actionItems.map((item: any, idx: number) => (
                        <Typography key={idx} variant="body2" sx={{ pl: 1, mb: 0.3 }}>• {typeof item === 'string' ? item : item.action}{item.priority ? ` [${item.priority}]` : ''}</Typography>
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

          {/* Trend Detection */}
          {trends && trends.trends?.length > 0 && (
            <Card sx={{ p: 3, mb: 4, border: '1px solid', borderColor: 'warning.light' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <TrendingDown color="warning" />
                <Typography variant="h6">
                  {i18n.language === 'ro' ? 'Tendințe săptămânale' : 'Weekly Trends'}
                </Typography>
                <Chip size="small" label={`${trends.trends.length} ${i18n.language === 'ro' ? 'schimbări semnificative' : 'significant changes'}`} />
              </Box>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                <Chip size="small" variant="outlined" label={`${i18n.language === 'ro' ? 'Săpt. curentă' : 'This week'}: ${trends.thisWeekFeedbackCount} fb`} />
                <Chip size="small" variant="outlined" label={`${i18n.language === 'ro' ? 'Săpt. trecută' : 'Last week'}: ${trends.lastWeekFeedbackCount} fb`} />
              </Box>
              {trends.trends.map((trend: any, idx: number) => (
                <Box key={idx} sx={{
                  mb: 1.5, p: 1.5, borderRadius: 1, border: '1px solid',
                  borderColor: trend.severity === 'high' ? 'error.main' : trend.severity === 'medium' ? 'warning.main' : 'divider',
                  bgcolor: trend.direction === 'down' ? 'error.50' : 'success.50',
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {trend.direction === 'down' ? <TrendingDown color="error" fontSize="small" /> : <TrendingUp color="success" fontSize="small" />}
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {trend.departmentName} — {trend.category}
                    </Typography>
                    <Chip size="small"
                      color={trend.direction === 'down' ? 'error' : 'success'}
                      label={`${trend.changePercent > 0 ? '+' : ''}${trend.changePercent}%`} />
                    <Chip size="small" variant="outlined"
                      color={trend.severity === 'high' ? 'error' : trend.severity === 'medium' ? 'warning' : 'default'}
                      label={trend.severity} sx={{ ml: 'auto' }} />
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {trend.lastWeekScore.toFixed(2)} → {trend.thisWeekScore.toFixed(2)}
                  </Typography>
                </Box>
              ))}
            </Card>
          )}

          {/* Accountability Metrics */}
          {accountability && (
            <Card sx={{ p: 3, mb: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Gavel color="primary" />
                <Typography variant="h6">
                  {i18n.language === 'ro' ? 'Metrici de responsabilitate' : 'Accountability Metrics'}
                </Typography>
              </Box>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: 'grey.50', borderRadius: 1 }}>
                    <Typography variant="h5" color="primary">{accountability.resolutionRate}%</Typography>
                    <Typography variant="caption">{i18n.language === 'ro' ? 'Rată rezolvare' : 'Resolution Rate'}</Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: 'grey.50', borderRadius: 1 }}>
                    <Typography variant="h5" color={accountability.avgResponseTimeHours > 48 ? 'error' : 'success'}>
                      {accountability.avgResponseTimeHours < 1 ? '<1h' : `${accountability.avgResponseTimeHours}h`}
                    </Typography>
                    <Typography variant="caption">{i18n.language === 'ro' ? 'Timp mediu răspuns' : 'Avg Response Time'}</Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: accountability.overdueAlerts > 0 ? 'error.50' : 'grey.50', borderRadius: 1 }}>
                    <Typography variant="h5" color={accountability.overdueAlerts > 0 ? 'error' : 'success'}>
                      {accountability.overdueAlerts}
                    </Typography>
                    <Typography variant="caption">{i18n.language === 'ro' ? 'Depășite (>48h)' : 'Overdue (>48h)'}</Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: accountability.recurrentIssues?.length > 0 ? 'warning.50' : 'grey.50', borderRadius: 1 }}>
                    <Typography variant="h5" color={accountability.recurrentIssues?.length > 0 ? 'warning' : 'success'}>
                      {accountability.recurrentIssues?.length || 0}
                    </Typography>
                    <Typography variant="caption">{i18n.language === 'ro' ? 'Probleme recurente' : 'Recurrent Issues'}</Typography>
                  </Box>
                </Grid>
              </Grid>
              {accountability.alertsByDepartment?.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    {i18n.language === 'ro' ? 'Alerte pe secții' : 'Alerts by Department'}
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>{i18n.language === 'ro' ? 'Secție' : 'Department'}</TableCell>
                          <TableCell align="center">Total</TableCell>
                          <TableCell align="center">{i18n.language === 'ro' ? 'Deschise' : 'Open'}</TableCell>
                          <TableCell align="center">{i18n.language === 'ro' ? 'Rezolvate' : 'Resolved'}</TableCell>
                          <TableCell align="center">{i18n.language === 'ro' ? 'Timp răspuns' : 'Response Time'}</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {accountability.alertsByDepartment.map((dept: any, idx: number) => (
                          <TableRow key={idx}>
                            <TableCell>{dept.department}</TableCell>
                            <TableCell align="center">{dept.total}</TableCell>
                            <TableCell align="center">
                              <Chip size="small" color={dept.open > 0 ? 'error' : 'default'} label={dept.open} />
                            </TableCell>
                            <TableCell align="center">
                              <Chip size="small" color="success" variant="outlined" label={dept.resolved} />
                            </TableCell>
                            <TableCell align="center">
                              {dept.avgResponseHours > 0 ? `${dept.avgResponseHours.toFixed(1)}h` : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}
            </Card>
          )}

          {/* Abuse Alerts - Case Management */}
          <Card sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom color="error">
              {i18n.language === 'ro' ? 'Cazuri de integritate' : 'Integrity Cases'}
            </Typography>
            {alerts.length === 0 ? (
              <Typography color="text.secondary">{t('dashboard.noAlerts')}</Typography>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>{i18n.language === 'ro' ? 'Cod' : 'Code'}</TableCell>
                      <TableCell>{i18n.language === 'ro' ? 'Data' : 'Date'}</TableCell>
                      <TableCell>{i18n.language === 'ro' ? 'Secție' : 'Dept'}</TableCell>
                      <TableCell>{i18n.language === 'ro' ? 'Tip' : 'Type'}</TableCell>
                      <TableCell>{i18n.language === 'ro' ? 'Status' : 'Status'}</TableCell>
                      <TableCell>{i18n.language === 'ro' ? 'Nivel' : 'Level'}</TableCell>
                      <TableCell>{i18n.language === 'ro' ? 'Acțiuni' : 'Actions'}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {alerts.map((alert: any) => (
                      <TableRow key={alert.id}
                        sx={{ bgcolor: alert.status === 'Open' ? 'error.50' : alert.status === 'Acknowledged' ? 'warning.50' : undefined, cursor: 'pointer' }}
                        onClick={() => viewAlertFeedback(alert.id)} hover>
                        <TableCell>
                          <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                            {alert.trackingCode || `#${alert.id}`}
                          </Typography>
                        </TableCell>
                        <TableCell>{new Date(alert.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>{alert.departmentName || '—'}</TableCell>
                        <TableCell>
                          <Chip size="small" variant="outlined"
                            color={alert.alertType === 'MoneyRequested' ? 'error' : 'warning'}
                            label={alert.alertType} />
                        </TableCell>
                        <TableCell>
                          <Chip size="small"
                            color={alert.status === 'Open' ? 'error' : alert.status === 'Resolved' || alert.status === 'Closed' ? 'success' : 'warning'}
                            label={alert.status} />
                        </TableCell>
                        <TableCell>
                          <Chip size="small" variant="outlined"
                            label={alert.escalationLevel?.replace('Level1_', 'L1: ').replace('Level2_', 'L2: ').replace('Level3_', 'L3: ')} />
                        </TableCell>
                        <TableCell onClick={e => e.stopPropagation()}>
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            <IconButton size="small" onClick={() => viewAlertFeedback(alert.id)} title="View">
                              <Visibility fontSize="small" />
                            </IconButton>
                            {alert.status === 'Open' && (
                              <Button size="small" variant="outlined" color="warning"
                                onClick={() => updateAlertStatus(alert.id, 'Acknowledged')}>
                                {i18n.language === 'ro' ? 'Confirmă' : 'Ack'}
                              </Button>
                            )}
                            {(alert.status === 'Acknowledged' || alert.status === 'Investigating') && (
                              <Button size="small" variant="outlined" color="success"
                                onClick={() => updateAlertStatus(alert.id, 'Resolved', 'Resolved by manager')}>
                                {i18n.language === 'ro' ? 'Rezolvă' : 'Resolve'}
                              </Button>
                            )}
                            {alert.status !== 'Resolved' && alert.status !== 'Closed' && (
                              <IconButton size="small" color="error" onClick={() => escalateAlert(alert.id)} title="Escalate">
                                <ArrowUpward fontSize="small" />
                              </IconButton>
                            )}
                          </Box>
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
                            {meta.actionItems.map((item: any, idx: number) => (
                              <Typography key={idx} variant="body2" sx={{ pl: 1 }}>• {typeof item === 'string' ? item : item.action}</Typography>
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
