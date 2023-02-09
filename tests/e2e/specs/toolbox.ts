import ToolboxPage from '../pages/toolbox-page';

const home = new ToolboxPage();

let metamaskWalletAddress;

describe('toolbox', () => {
  context('Connect phantom wallet', () => {
    before(() => {
      cy.fetchWalletAddress().then((address) => {
        metamaskWalletAddress = address;
      });
      cy.visit('/');
    });
    it('should lock wallet and unlock it correctly', () => {
      cy.lock();
      cy.unlock();
    });
    it('should login with success', () => {
      cy.get(home.buttons.connect).click();
      cy.acceptAccess();
      cy.contains(metamaskWalletAddress.toLowerCase());
    });
    it('Should sign a regular message correctly', () => {
      cy.get(home.buttons.signMessage('0x5')).click();
      cy.confirmSignatureRequest();
    });
    it('Should send a transaction', () => {
      cy.get(home.buttons.sendTransaction('0x5')).click();
      cy.confirmIncorrectNetworkStage();
    });
  });
});
