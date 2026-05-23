import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  AppBar, Toolbar, Typography, Button, IconButton, Box, Drawer,
  List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  useMediaQuery, useTheme, Menu, MenuItem,
} from '@mui/material';
import {
  Menu as MenuIcon, LocalHospital, Map, Dashboard,
  Login, Logout, AdminPanelSettings, Language, MedicalInformation,
  EventNote, Search as SearchIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { t, i18n } = useTranslation();
  const { isAuthenticated, logout } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [langAnchor, setLangAnchor] = useState<null | HTMLElement>(null);
  const location = useLocation();

  const navItems = [
    { label: t('nav.hospitals'), path: '/', icon: <LocalHospital /> },
    { label: t('nav.symptoms'), path: '/symptoms', icon: <MedicalInformation /> },
    { label: t('nav.reservationStatus'), path: '/reservation-status', icon: <SearchIcon /> },
    { label: t('nav.map'), path: '/map', icon: <Map /> },
    ...(isAuthenticated ? [
      { label: t('nav.reservations'), path: '/reservations', icon: <EventNote /> },
      { label: t('nav.dashboard'), path: '/dashboard', icon: <Dashboard /> },
      { label: t('nav.admin'), path: '/admin', icon: <AdminPanelSettings /> },
    ] : []),
  ];

  const toggleLang = () => {
    i18n.changeLanguage(i18n.language === 'ro' ? 'en' : 'ro');
    setLangAnchor(null);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="sticky" elevation={0} sx={{ bgcolor: 'white', borderBottom: '1px solid #e0e0e0' }}>
        <Toolbar>
          {isMobile && (
            <IconButton edge="start" onClick={() => setDrawerOpen(true)} sx={{ mr: 1 }}>
              <MenuIcon />
            </IconButton>
          )}
          <LocalHospital sx={{ color: 'primary.main', mr: 1 }} />
          <Typography variant="h6" component={Link} to="/"
            sx={{ flexGrow: 0, textDecoration: 'none', color: 'primary.main', fontWeight: 700, mr: 4 }}>
            {t('app.title')}
          </Typography>

          {!isMobile && (
            <Box sx={{ display: 'flex', gap: 1, flexGrow: 1 }}>
              {navItems.map(item => (
                <Button key={item.path} component={Link} to={item.path}
                  startIcon={item.icon}
                  variant={location.pathname === item.path ? 'contained' : 'text'}
                  size="small">
                  {item.label}
                </Button>
              ))}
            </Box>
          )}

          <Box sx={{ flexGrow: 1 }} />

          <IconButton onClick={(e) => setLangAnchor(e.currentTarget)} size="small" sx={{ mr: 1 }}>
            <Language />
          </IconButton>
          <Menu anchorEl={langAnchor} open={!!langAnchor} onClose={() => setLangAnchor(null)}>
            <MenuItem onClick={toggleLang} selected={i18n.language === 'ro'}>🇷🇴 Romana</MenuItem>
            <MenuItem onClick={toggleLang} selected={i18n.language === 'en'}>🇬🇧 English</MenuItem>
          </Menu>

          {isAuthenticated ? (
            <Button startIcon={<Logout />} onClick={logout} size="small">
              {t('nav.logout')}
            </Button>
          ) : (
            <Button startIcon={<Login />} component={Link} to="/login" variant="outlined" size="small">
              {t('nav.login')}
            </Button>
          )}
        </Toolbar>
      </AppBar>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <Box sx={{ width: 260, pt: 2 }}>
          <List>
            {navItems.map(item => (
              <ListItem key={item.path} disablePadding>
                <ListItemButton component={Link} to={item.path}
                  selected={location.pathname === item.path}
                  onClick={() => setDrawerOpen(false)}>
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.label} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, bgcolor: 'background.default' }}>
        {children}
      </Box>
    </Box>
  );
}
