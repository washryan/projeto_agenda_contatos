import '@fontsource/oswald/600.css';
import '@fontsource/oswald/700.css';
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/500.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import '@fontsource/fira-code/400.css';
import '@fontsource/fira-code/500.css';

import './styles/tokens.css';
import './styles/base.css';
import './styles/background.css';
import './styles/layout.css';
import './styles/components.css';

import { initConnectedUniverse } from './background/connectedUniverse';
import { mountAgendaApp } from './ui/app';

const canvasEl = document.getElementById('universe-canvas');
if (canvasEl instanceof HTMLCanvasElement) {
  initConnectedUniverse(canvasEl);
}

const appRoot = document.getElementById('app');
if (appRoot) {
  mountAgendaApp(appRoot);
}
