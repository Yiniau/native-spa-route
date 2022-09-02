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
    expect(el._route_match_check_grouped_path).to.equal(['', 'root', /(?:hello)|(?:world)/]);
  });

  // it('has a default title "Hey there" and counter 5', async () => {
  //   const el: MyElement = await fixture(html` <my-element></my-element> `);

  //   expect(el.title).to.equal('Hey there');
  //   expect(el.counter).to.equal(5);
  // });

  // it('increases the counter on button click', async () => {
  //   const el: MyElement = await fixture(html` <my-element></my-element> `);
  //   el.shadowRoot!.querySelector('button')!.click();

  //   expect(el.counter).to.equal(6);
  // });

  // it('can override the title via attribute', async () => {
  //   const el: MyElement = await fixture(html` <my-element title="attribute title"></my-element> `);

  //   expect(el.title).to.equal('attribute title');
  // });

  // it('passes the a11y audit', async () => {
  //   const el: MyElement = await fixture(html` <my-element></my-element> `);

  //   await expect(el).shadowDom.to.be.accessible();
  // });
});
