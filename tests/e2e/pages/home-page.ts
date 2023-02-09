import Page from './page';

export default class HomePage extends Page {
  visit() {
    cy.visit('/');
  }
}
