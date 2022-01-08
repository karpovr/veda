export const html = `
  <div>
    <style>
      .links-tree ul {
        list-style-type: none;
        padding-left: 18px;
      }

      .links-tree ul li {
        margin: 10px 0;
      }

      .links-tree .expand,
      .links-tree .expand-type {
        text-decoration: none;
      }
    </style>
    <div class="links-tree" about="@" data-template="v-s:LinksTreeRecursiveTemplate"></div>
  </div>
`;
