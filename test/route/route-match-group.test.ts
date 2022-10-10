import { html, fixture, expect } from '@open-wc/testing';
import type { Route } from '../../src/components/route';

describe('route', () => {
  it('route match group parse [with vaild root path] [with regexp] [with group mode]', async () => {
    let el: Route = await fixture(html`
      <native-route path="/root">
        <native-route path=":(?:hello)|(?:world)" groupMatchMode></native-route>
      </native-route>
    `);
    el = el.children[0] as Route;
    const correct_ret = ['', 'root', /(?:hello)|(?:world)/];
    expect(el._route_match_check_grouped_path).deep.equal(correct_ret);
  });
  it('nest route test', async () => {
    location.href = '/hello/world';
    let el: Route = await fixture(html`
      <native-route path="/root">
        <native-route path=":(?:hello/world)" groupMatchMode></native-route>
      </native-route>
    `);
    el = el.children[0] as Route;
    const correct_ret = ['', 'root', /(?:hello\/world)/];
    expect(el._route_match_check_grouped_path).deep.equal(correct_ret);
    expect(el.isActive(), true);
  });
});
