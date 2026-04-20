import React from 'react';
import { GitHub } from 'react-feather';

const Footer: React.FC = () => (
  <footer className="pt-6 pb-18 md:py-8">
    <div className="app-container">
      <div className="flex items-center justify-between gap-4 text-sm text-(--text-muted)">
        <span>Copyright 2026 Fedor Glukhov</span>
        <a
          href="https://github.com/fglukhov/rootnote"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-(--text-muted) transition-colors hover:text-(--text-secondary)"
          aria-label="GitHub repository"
        >
          <GitHub size={16} />
          <span>GitHub</span>
        </a>
      </div>
    </div>
  </footer>
);

export default Footer;
