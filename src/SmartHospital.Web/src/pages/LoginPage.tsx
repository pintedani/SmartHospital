import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container, Card, CardContent, Typography, TextField, Button, Box, Alert,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch {
      setError(t('login.error'));
    }
    setLoading(false);
  };

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Card>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h5" gutterBottom sx={{ textAlign: 'center' }}>{t('login.title')}</Typography>

          <Alert severity="info" sx={{ mb: 3 }}>{t('login.demo')}</Alert>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField label={t('login.email')} type="email" value={email}
              onChange={e => setEmail(e.target.value)} required fullWidth />
            <TextField label={t('login.password')} type="password" value={password}
              onChange={e => setPassword(e.target.value)} required fullWidth />
            <Button type="submit" variant="contained" size="large" disabled={loading} fullWidth>
              {t('login.submit')}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
}
