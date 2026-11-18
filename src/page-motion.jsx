import React from 'react';
import {createRoot} from 'react-dom/client';
import Threads from './components/Threads';
for(const node of document.querySelectorAll('.page-flow'))createRoot(node).render(<Threads/>);
// Document pages do not load experience.jsx, which owns this event on the
// legacy landing page. Keep their mounted effects in sync with live OS changes.
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
reduced.addEventListener('change',event=>document.dispatchEvent(new CustomEvent('foundryx:motion',{detail:{paused:event.matches}})));
