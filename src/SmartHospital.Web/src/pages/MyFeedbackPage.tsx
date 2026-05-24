import { useState, useEffect } from 'react';
import {
  Container, Typography, Box, Card, CardContent, Chip, Rating,
  Grid, CircularProgress, Alert, Divider,
} from '@mui/material';
import { Feedback, LocalHospital } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

interface FeedbackAnswer {
  question: string;
  questionEN: string;
  ratingValue: number | null;
  textValue: string | null;
  selectedOption: string | null;
}

interface MyFeedback {
  id: number;
  submittedAt: string;
  hospitalName: string;
  hospitalNameEN: string;
  departmentName: string | null;
  departmentNameEN: string | null;
  averageRating: number;
  answers: FeedbackAnswer[];
}

export default function MyFeedbackPage() {
  const { i18n } = useTranslation();
  const [feedbacks, setFeedbacks] = useState<MyFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const isRO = i18n.language === 'ro';

  useEffect(() => {
    api.get('/feedback/my')
      .then(res => setFeedbacks(res.data))
      .catch(() => setError(isRO ? 'Eroare la încărcarea review-urilor' : 'Error loading reviews'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <Feedback color="primary" sx={{ fontSize: 32 }} />
        <Typography variant="h4">
          {isRO ? 'Review-urile mele' : 'My Reviews'}
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {feedbacks.length === 0 && !error && (
        <Alert severity="info">
          {isRO ? 'Nu aveți niciun review trimis. Completați un formular de feedback pentru a vedea review-urile aici.' 
                 : 'You have no reviews yet. Submit a feedback form to see your reviews here.'}
        </Alert>
      )}

      <Grid container spacing={3}>
        {feedbacks.map(fb => (
          <Grid size={{ xs: 12 }} key={fb.id}>
            <Card sx={{ border: '1px solid #e0e0e0' }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LocalHospital color="primary" fontSize="small" />
                    <Typography variant="h6">
                      {isRO ? fb.hospitalName : fb.hospitalNameEN}
                    </Typography>
                  </Box>
                  <Chip
                    size="small"
                    label={new Date(fb.submittedAt).toLocaleDateString(isRO ? 'ro-RO' : 'en-US', {
                      year: 'numeric', month: 'short', day: 'numeric',
                    })}
                    variant="outlined"
                  />
                </Box>

                {fb.departmentName && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {isRO ? fb.departmentName : fb.departmentNameEN}
                  </Typography>
                )}

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Rating value={fb.averageRating} precision={0.5} readOnly size="small" />
                  <Typography variant="body2" color="text.secondary">
                    ({fb.averageRating.toFixed(1)}/5)
                  </Typography>
                </Box>

                <Divider sx={{ mb: 2 }} />

                {fb.answers.map((a, idx) => (
                  <Box key={idx} sx={{ mb: 1.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {isRO ? a.question : a.questionEN}
                    </Typography>
                    {a.ratingValue && (
                      <Rating value={a.ratingValue} readOnly size="small" sx={{ mt: 0.5 }} />
                    )}
                    {a.textValue && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontStyle: 'italic' }}>
                        "{a.textValue}"
                      </Typography>
                    )}
                    {a.selectedOption && (
                      <Chip size="small" label={a.selectedOption} sx={{ mt: 0.5 }} />
                    )}
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
}
