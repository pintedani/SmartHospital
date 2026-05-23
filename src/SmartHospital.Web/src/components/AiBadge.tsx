import { Chip, Tooltip } from '@mui/material';
import { AutoAwesome } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface AiBadgeProps {
  size?: 'small' | 'medium';
}

export default function AiBadge({ size = 'small' }: AiBadgeProps) {
  const { t } = useTranslation();

  return (
    <Tooltip title={t('ai.tooltip')}>
      <Chip
        icon={<AutoAwesome sx={{ fontSize: size === 'small' ? 14 : 18 }} />}
        label="AI"
        size={size}
        sx={{
          background: 'linear-gradient(135deg, #7c3aed 0%, #2563eb 100%)',
          color: '#fff',
          fontWeight: 700,
          fontSize: size === 'small' ? '0.7rem' : '0.85rem',
          '& .MuiChip-icon': { color: '#fff' },
          animation: 'shimmer 2s infinite',
          '@keyframes shimmer': {
            '0%, 100%': { opacity: 1 },
            '50%': { opacity: 0.85 },
          },
        }}
      />
    </Tooltip>
  );
}
