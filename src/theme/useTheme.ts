/**
 * @file Theme hooks
 * `useTheme` reads the preference (the signed-in user's saved one, else this browser's) and
 * saves a new one to the account, this browser and the store. `useApplyTheme` (mounted once in
 * App) keeps `<html data-theme>` in step, following the device while the preference is `system`.
 */
import { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../store';
import { setUser } from '../store/authSlice';
import { useUpdatePreferencesMutation } from '../api/preferencesApi';
import {
  applyTheme,
  isThemePreference,
  readStoredPreference,
  resolveTheme,
  storePreference,
  type ThemePreference,
} from './theme';

export function useTheme(): {
  preference: ThemePreference;
  setPreference: (pref: ThemePreference) => void;
} {
  const dispatch = useDispatch();
  const user = useSelector((s: RootState) => s.auth.user);
  const [local, setLocal] = useState<ThemePreference>(readStoredPreference);
  const [save] = useUpdatePreferencesMutation();

  const preference = isThemePreference(user?.theme) ? user.theme : local;

  const setPreference = useCallback(
    (pref: ThemePreference) => {
      setLocal(pref);
      storePreference(pref);
      if (user) {
        dispatch(setUser({ ...user, theme: pref }));
        // The theme already changed here; a failed save only means another device keeps the old one.
        save({ theme: pref })
          .unwrap()
          .catch(() => undefined);
      }
    },
    [dispatch, save, user]
  );

  return { preference, setPreference };
}

export function useApplyTheme(): void {
  const { preference } = useTheme();

  useEffect(() => {
    storePreference(preference);
    const apply = () => applyTheme(resolveTheme(preference));
    apply();
    if (preference !== 'system' || !window.matchMedia) return;
    const media = window.matchMedia('(prefers-color-scheme: light)');
    media.addEventListener?.('change', apply);
    return () => media.removeEventListener?.('change', apply);
  }, [preference]);
}
