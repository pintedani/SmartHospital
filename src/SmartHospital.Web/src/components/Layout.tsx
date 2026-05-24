import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  AppBar, Toolbar, Typography, Button, IconButton, Box, Drawer,
  List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  useMediaQuery, useTheme, Menu, MenuItem, Avatar, Divider,
} from '@mui/material';
import {
  Menu as MenuIcon, LocalHospital, Map, Dashboard,
  Login, Logout, AdminPanelSettings, Language, MedicalInformation,
  EventNote, Search as SearchIcon, RateReview,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { t, i18n } = useTranslation();
  const { isAuthenticated, user, logout } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [langAnchor, setLangAnchor] = useState<null | HTMLElement>(null);
  const [userAnchor, setUserAnchor] = useState<null | HTMLElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  const isAdmin = user?.role === 'Admin';
  const isManager = user?.role === 'Manager';
  const isStaff = isAdmin || isManager;

  const navItems = [
    { label: t('nav.hospitals'), path: '/', icon: <LocalHospital /> },
    { label: t('nav.symptoms'), path: '/symptoms', icon: <MedicalInformation /> },
    { label: t('nav.reservationStatus'), path: '/reservation-status', icon: <SearchIcon /> },
    { label: t('nav.map'), path: '/map', icon: <Map /> },
    ...(isStaff ? [
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
          <Box component={Link} to="/" sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
            <img src="/SmartHospital.png" alt="SmartHospital" style={{ height: 48, marginRight: 10 }} />
            <Typography variant="h6"
              sx={{ color: 'primary.main', fontWeight: 700 }}>
              {t('app.title')}
            </Typography>
          </Box>

          {!isMobile && (
            <Box sx={{ display: 'flex', gap: 1, flexGrow: 1, justifyContent: 'center' }}>
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

          {isMobile && <Box sx={{ flexGrow: 1 }} />}

          <IconButton onClick={(e) => setLangAnchor(e.currentTarget)} size="small" sx={{ mr: 1 }}>
            <Language />
          </IconButton>
          <Menu anchorEl={langAnchor} open={!!langAnchor} onClose={() => setLangAnchor(null)}>
            <MenuItem onClick={toggleLang} selected={i18n.language === 'ro'}>🇷🇴 Romana</MenuItem>
            <MenuItem onClick={toggleLang} selected={i18n.language === 'en'}>🇬🇧 English</MenuItem>
          </Menu>

          {isAuthenticated ? (
            <>
              <IconButton onClick={(e) => setUserAnchor(e.currentTarget)} size="small">
                <Avatar sx={{ width: 34, height: 34, bgcolor: 'primary.main', fontSize: 16 }}>
                  {user?.fullName?.charAt(0).toUpperCase() || '?'}
                </Avatar>
              </IconButton>
              <Menu
                anchorEl={userAnchor}
                open={!!userAnchor}
                onClose={() => setUserAnchor(null)}
                slotProps={{ paper: { sx: { minWidth: 220, mt: 1 } } }}
              >
                <Box sx={{ px: 2, py: 1.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{user?.fullName}</Typography>
                  <Typography variant="body2" color="text.secondary">{user?.email}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {user?.role === 'Admin' ? '🛡️ Administrator' : user?.role === 'Manager' ? '🏥 Manager' : '👤 Pacient'}
                  </Typography>
                </Box>
                <Divider />
                <MenuItem onClick={() => { setUserAnchor(null); navigate('/reservations'); }}>
                  <ListItemIcon><EventNote fontSize="small" /></ListItemIcon>
                  {i18n.language === 'ro' ? 'Programările mele' : 'My Reservations'}
                </MenuItem>
                <MenuItem onClick={() => { setUserAnchor(null); navigate('/my-reviews'); }}>
                  <ListItemIcon><RateReview fontSize="small" /></ListItemIcon>
                  {i18n.language === 'ro' ? 'Review-urile mele' : 'My Reviews'}
                </MenuItem>
                <Divider />
                <MenuItem onClick={() => { setUserAnchor(null); logout(); }}>
                  <ListItemIcon><Logout fontSize="small" /></ListItemIcon>
                  {t('nav.logout')}
                </MenuItem>
              </Menu>
            </>
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
