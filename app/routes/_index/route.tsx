import type { LoaderFunctionArgs } from "react-router";
import { redirect, Form, useLoaderData } from "react-router";

import { login } from "../../shopify.server";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <div className={styles.logo}>🎬 Lexor Media Gallery</div>
        <h1 className={styles.heading}>Professional Media Library Management</h1>
        <p className={styles.text}>
          Organize, store, and display high-quality images & videos seamlessly on your Shopify store.
        </p>
        
        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span>Enter your shop domain</span>
              <input 
                className={styles.input} 
                type="text" 
                name="shop" 
                placeholder="my-shop.myshopify.com" 
              />
              <span className={styles.hint}>Example: store-name.myshopify.com</span>
            </label>
            <button className={styles.button} type="submit">
              Connect & Install
            </button>
          </Form>
        )}
        
        <ul className={styles.list}>
          <li>
            <strong>Multi-level Tree Structure</strong>
            <p>Group media systematically by Categories, Sub-categories, and Folders to easily manage thousands of files.</p>
          </li>
          <li>
            <strong>Drag & Drop Reordering</strong>
            <p>Rearrange the display order of folders and media items with intuitive drag-and-drop operations on the fly.</p>
          </li>
          <li>
            <strong>Performance Optimized</strong>
            <p>Automatically display smart image placeholders instead of heavy video metadata to maximize storefront Core Web Vitals.</p>
          </li>
        </ul>
      </div>
    </div>
  );
}
