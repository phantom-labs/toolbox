import Page from './page';

export default class MetamaskPage extends Page {
  visit() {
    cy.visit('/');
  }
}
