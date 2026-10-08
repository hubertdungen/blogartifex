import React from 'react';
import { render, screen } from '@testing-library/react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import App from './App';

test('renders login page heading', async () => {
  render(
    <GoogleOAuthProvider clientId="test">
      <App />
    </GoogleOAuthProvider>
  );
  const heading = await screen.findByText(/blogartifex/i);
  expect(heading).toBeInTheDocument();
});

test('renders even when saved settings contain invalid JSON', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  localStorage.setItem('blogartifex_settings', '{invalid');

  try {
    render(
      <GoogleOAuthProvider clientId="test">
        <App />
      </GoogleOAuthProvider>
    );

    expect(await screen.findByText(/blogartifex/i)).toBeInTheDocument();
  } finally {
    warn.mockRestore();
  }
});
