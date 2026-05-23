import { useEffect, useState } from 'react';
import { Container, Typography, Box, CircularProgress } from '@mui/material';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import L from 'leaflet';
import api from '../services/api';
import 'leaflet/dist/leaflet.css';

// Fix default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface Hospital {
  id: number; name: string; nameEN: string; city: string; type: string;
  totalBeds: number; totalDoctors: number; latitude: number; longitude: number;
  averageRating: number | null; feedbackCount: number;
}

export default function MapPage() {
  const { t, i18n } = useTranslation();
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/hospitals').then(res => {
      setHospitals(res.data);
      setLoading(false);
    });
  }, []);

  const getName = (h: Hospital) => i18n.language === 'en' && h.nameEN ? h.nameEN : h.name;

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>{t('map.title')}</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>{t('map.subtitle')}</Typography>

      <Box sx={{ height: '70vh', borderRadius: 3, overflow: 'hidden', boxShadow: 3 }}>
        <MapContainer
          center={[46.77, 23.59]}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {hospitals.map(h => (
            <Marker key={h.id} position={[h.latitude, h.longitude]}>
              <Popup>
                <Box sx={{ minWidth: 200 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    <Link to={`/hospital/${h.id}`} style={{ color: '#1976d2', textDecoration: 'none' }}>
                      {getName(h)}
                    </Link>
                  </Typography>
                  <Typography variant="body2" color="text.secondary">{t(`hospitalTypes.${h.type}`)}</Typography>
                  <Typography variant="body2">
                    {h.totalBeds} {t('hospitals.beds')} | {h.totalDoctors} {t('hospitals.doctors')}
                  </Typography>
                  {h.averageRating && (
                    <Typography variant="body2">⭐ {h.averageRating.toFixed(1)} / 4.0</Typography>
                  )}
                </Box>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </Box>
    </Container>
  );
}
