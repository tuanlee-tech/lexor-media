import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const search = url.searchParams.get("search") || "";
  const cursor = url.searchParams.get("cursor");

  const query = `
    query getFiles($first: Int!, $query: String, $after: String) {
      files(first: $first, query: $query, after: $after, sortKey: CREATED_AT, reverse: true) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
            alt
            createdAt
            fileStatus
            ... on MediaImage {
              image { url width height }
            }
            ... on Video {
              preview { image { url } }
              sources { url format mimeType }
            }
            ... on ExternalVideo {
              embedUrl
              host
              preview { image { url } }
            }
          }
        }
      }
    }
  `;

  let searchQuery = "media_type:IMAGE OR media_type:VIDEO OR media_type:EXTERNAL_VIDEO";
  if (search) {
    searchQuery = `(${searchQuery}) AND ${search}`;
  }

  const response = await admin.graphql(query, {
    variables: {
      first: 50,
      query: searchQuery,
      after: cursor || null,
    },
  });

  const data = await response.json();
  return new Response(JSON.stringify(data.data.files), {
    headers: { "Content-Type": "application/json" }
  });
};
