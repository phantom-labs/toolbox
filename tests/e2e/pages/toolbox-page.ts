import Page from './page';

export default class ToolboxPage extends Page {
  visit() {
    cy.visit('/');
  }

  buttons = {
    connect: '[data-testid="connect-to-phantom"]',
    signMessage: (chainId = '0x5') => `[data-testid="${chainId}-sign-message"]`,
    sendTransaction: (chainId = '0x5') => `[data-testid="${chainId}-send-transaction"]`,
  };
}
