import React from 'react';
import Document, { Head, Html, Main, NextScript } from 'next/document';

export default class AllternitDocument extends Document {
  render() {
    return React.createElement(
      Html,
      { lang: 'en' },
      React.createElement(Head, null),
      React.createElement(
        'body',
        { className: 'antialiased' },
        React.createElement(Main, null),
        React.createElement(NextScript, null),
      ),
    );
  }
}
