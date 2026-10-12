import { atom } from 'jotai';
import type { USAGE_TAB } from './constants';

/**
 * estudiante-ia-app: pestaña con la que debe abrirse Configuración la próxima vez.
 * La fija el atajo "Uso" del menú de cuenta; null = la pestaña por defecto.
 */
export const settingsInitialTabAtom = atom<typeof USAGE_TAB | null>(null);
