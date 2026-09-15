const LEXOR_URL_KEYS = {
  category: 'cat',
  subCategory: 'sub',
  folder: 'folder',
  folderShort: 'f',
  mediaType: 'm',
};

const LEXOR_GLOBAL_ALL_CATEGORY = 'all-media';
const LEXOR_VALID_MEDIA_TYPES = ['all', 'video', 'image', 'folder'];
const FANCYBOX_CSS =
  'https://cdn.jsdelivr.net/npm/@fancyapps/ui@5.0/dist/fancybox/fancybox.css';
const FANCYBOX_JS =
  'https://cdn.jsdelivr.net/npm/@fancyapps/ui@5.0/dist/fancybox/fancybox.umd.js';

class LexorMediaGallery extends HTMLElement {
  constructor() {
    super();
    this.state = {
      tree: [],
      category: LEXOR_GLOBAL_ALL_CATEGORY,
      sub: '',
      folder: '',
      folderTitle: '',
      type: 'all',
      page: 1,
      limit: Number(this.getAttribute('limit') || 18),
      search: '',
      folders: [],
      media: [],
      hasMore: false,
      loading: false,
      error: '',
      drawerOpen: false,
      modal: null,
      ready: false,
      viewMode: 'sub', // 'category' | 'sub' | 'folder' — đang xem ở level nào
    };

    this.onClick = this.onClick.bind(this);
    this.onInput = this.onInput.bind(this);
    this.onKeydown = this.onKeydown.bind(this);
    this.onPopstate = this.onPopstate.bind(this);
  }

  connectedCallback() {
    this.apiBase = (this.getAttribute('api-base') || '').replace(/\/$/, '');
    this.fancyboxEnabled = this.getAttribute('enable-fancybox') !== 'false';

    if (!this.apiBase) {
      this.innerHTML = this.renderState(
        'Missing API base',
        'Please set api-base attribute.',
      );
      return;
    }

    this.classList.add('lexor-gallery-host');
    this.addEventListener('click', this.onClick);
    this.addEventListener('input', this.onInput);
    document.addEventListener('keydown', this.onKeydown);
    window.addEventListener('popstate', this.onPopstate);
    this.ensureFancyboxAssets();
    this.loadInitial();
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.onClick);
    this.removeEventListener('input', this.onInput);
    document.removeEventListener('keydown', this.onKeydown);
    window.removeEventListener('popstate', this.onPopstate);
    document.body.classList.remove('media-gallery-drawer-open');
    if (this.observer) this.observer.disconnect();
  }

  renderState(title, text) {
    return `
      <section class="media-gallery-section is-ready" data-media-gallery-section>
        <div class="media-gallery__empty">
          <h3 class="media-gallery__empty-title">${this.escape(title)}</h3>
          <p class="media-gallery__empty-text">${this.escape(text)}</p>
        </div>
      </section>
    `;
  }

  async api(path) {
    const response = await fetch(`${this.apiBase}${path}`);
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(
        data?.message || data?.error || `API error ${response.status}`,
      );
    }
    return data;
  }

  async loadInitial() {
    this.state.loading = true;
    this.render();

    try {
      const data = await this.api('/api/gallery/tree');
      this.state.tree = data.categories || [];
      this.applyStateFromUrlParams();
      await this.loadMedia(true, { skipUrlUpdate: true });
      this.state.ready = true;
    } catch (error) {
      this.state.error = error.message;
      this.state.loading = false;
      this.state.ready = true;
      this.render();
    }
  }

  async loadMedia(reset = true, options = {}) {
    if (reset) {
      this.state.page = 1;
      this.state.folders = [];
      this.state.media = [];
    }

    this.state.loading = true;
    this.state.error = '';
    this.render();

    const params = new URLSearchParams({
      category: this.state.category || LEXOR_GLOBAL_ALL_CATEGORY,
      type: this.state.type,
      page: String(this.state.page),
      limit: String(this.state.limit),
    });

    if (this.state.sub) params.set('sub', this.state.sub);
    if (this.state.folder) params.set('folder', this.state.folder);
    if (this.state.search) params.set('search', this.state.search);

    try {
      const data = await this.api(`/api/gallery/media?${params.toString()}`);
      this.state.folders = reset ? data.folders || [] : this.state.folders;
      const incoming = data.media || [];
      this.state.media = reset ? incoming : [...this.state.media, ...incoming];
      this.state.hasMore = Boolean(data.has_more);

      if (data.scope?.folder) {
        this.state.folder = data.scope.folder.handle || this.state.folder;
        this.state.folderTitle = data.scope.folder.title || this.state.folderTitle;
      } else {
        this.state.folder = '';           // Reset khi không ở folder
        this.state.folderTitle = '';
      }

      this.state.loading = false;
      this.state.ready = true;
      if (!options.skipUrlUpdate) this.updateUrlParams();
      this.render();
    } catch (error) {
      this.state.error = error.message;
      this.state.loading = false;
      this.state.ready = true;
      this.render();
    }
  }

  async onPopstate() {
    this.applyStateFromUrlParams();
    this.closeDrawer();
    await this.loadMedia(true, { skipUrlUpdate: true });
  }

  onKeydown(event) {
    if (event.key === 'Escape' && this.state.drawerOpen) this.closeDrawer();
    if (event.key === 'Escape' && this.state.modal) {
      this.state.modal = null;
      this.render();
    }
  }

  onInput(event) {
    const target = event.target;
    if (!target.matches('[data-search]')) return;

    window.clearTimeout(this.searchTimer);
    this.searchTimer = window.setTimeout(() => {
      this.state.search = target.value.trim();
      this.loadMedia(true);
    }, 280);
  }

  onClick(event) {
    const actionEl = event.target.closest('[data-action]');
    if (!actionEl) return;

    const action = actionEl.dataset.action;

    if (action === 'open-drawer') {
      event.preventDefault();
      this.openDrawer();
      return;
    }

    if (action === 'close-drawer') {
      event.preventDefault();
      this.closeDrawer();
      return;
    }

    if (action === 'select-all') {
      event.preventDefault();
      this.state.category = LEXOR_GLOBAL_ALL_CATEGORY;
      this.state.sub = '';
      this.state.folder = '';
      this.state.folderTitle = '';
      this.state.type = 'all';
      this.closeDrawer();
      this.loadMedia(true);
      return;
    }

    if (action === 'toggle-category') {
      event.preventDefault();
      const group = actionEl.closest('[data-sidebar-group]');
      const sidebar = actionEl.closest('[data-media-sidebar]');
      if (!group) return;
      sidebar?.querySelectorAll('[data-sidebar-group]').forEach((item) => {
        if (item !== group) item.classList.remove('is-open');
        const button = item.querySelector('[data-sidebar-group-button]');
        if (button && item !== group)
          button.setAttribute('aria-expanded', 'false');
      });
      group.classList.toggle('is-open');
      actionEl.setAttribute(
        'aria-expanded',
        group.classList.contains('is-open') ? 'true' : 'false',
      );
      return;
    }

    if (action === 'select-sub') {
      event.preventDefault();
      this.state.category = actionEl.dataset.category || '';
      this.state.sub = actionEl.dataset.sub || '';
      this.state.folder = '';
      this.state.folderTitle = '';
      this.state.type = 'all';
      this.state.viewMode = 'sub';
      this.closeDrawer();
      this.loadMedia(true);
      return;
    }

    if (action === 'tab') {
      event.preventDefault();
      this.state.type = actionEl.dataset.type || 'all';
      this.loadMedia(true);
      return;
    }

    if (action === 'open-folder') {
      event.preventDefault();
      this.state.folder = actionEl.dataset.folder || '';
      this.state.folderTitle =
        actionEl.dataset.title || this.titleFromHandle(this.state.folder);
      this.state.type = 'all';
      this.loadMedia(true);
      return;
    }

    if (action === 'back-folder') {
      event.preventDefault();
      this.state.folder = '';
      this.state.folderTitle = '';
      this.state.type = 'all';
      this.loadMedia(true);
      return;
    }

    if (action === 'load-more') {
      event.preventDefault();
      this.state.page += 1;
      this.loadMedia(false);
      return;
    }

    if (action === 'open-media') {
      event.preventDefault();
      const item = this.state.media.find(
        (media) => String(media.id) === actionEl.dataset.id,
      );
      if (!item) return;
      this.openMedia(item);
      return;
    }

    if (action === 'close-modal') {
      event.preventDefault();
      this.state.modal = null;
      this.render();
    }

    if (action === 'select-category') {
      event.preventDefault();
      this.state.category = actionEl.dataset.category || '';
      this.state.sub = '';
      this.state.folder = '';
      this.state.folderTitle = '';
      this.state.type = 'all';
      this.state.viewMode = 'category';
      this.closeDrawer();
      this.loadMedia(true);
      return;
    }
  }

  openDrawer() {
    this.state.drawerOpen = true;
    document.body.classList.add('media-gallery-drawer-open');
    const drawer = this.querySelector('[data-media-drawer]');
    const overlay = this.querySelector('[data-media-drawer-overlay]');
    drawer?.classList.add('is-open');
    overlay?.classList.add('is-open');
    drawer?.removeAttribute('hidden');
    overlay?.removeAttribute('hidden');
  }

  closeDrawer() {
    this.state.drawerOpen = false;
    document.body.classList.remove('media-gallery-drawer-open');
    const drawer = this.querySelector('[data-media-drawer]');
    const overlay = this.querySelector('[data-media-drawer-overlay]');
    drawer?.classList.remove('is-open');
    overlay?.classList.remove('is-open');
    drawer?.setAttribute('hidden', '');
    overlay?.setAttribute('hidden', '');
  }

  openMedia(item) {
    if (this.fancyboxEnabled && window.Fancybox) {
      const slide = this.getFancyboxSlide(item);
      window.Fancybox.show([slide], {
        groupAll: false,
        Thumbs: false,
        caption: item.title || '',
      });
      return;
    }

    this.state.modal = item;
    this.render();
  }

  getFancyboxSlide(item) {
    if (item.media_type === 'image') {
      return {
        src: item.url,
        type: 'image',
        caption: item.title || '',
      };
    }

    if (item.source_type === 'youtube') {
      const id = this.youtubeId(item.url);
      return {
        src: id ? `https://www.youtube.com/watch?v=${id}` : item.url,
        type: 'youtube',
        caption: item.title || '',
      };
    }

    if (this.isSelfHostedVideo(item.url)) {
      return {
        src: `<video class="media-gallery__fancybox-video" src="${this.escape(item.url)}" controls autoplay playsinline preload="metadata"></video>`,
        type: 'html',
        caption: item.title || '',
      };
    }

    return {
      src: item.url,
      type: 'iframe',
      caption: item.title || '',
    };
  }

  ensureFancyboxAssets() {
    if (!this.fancyboxEnabled || window.Fancybox) return;

    if (!document.querySelector(`link[href="${FANCYBOX_CSS}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = FANCYBOX_CSS;
      document.head.appendChild(link);
    }

    if (!document.querySelector(`script[src="${FANCYBOX_JS}"]`)) {
      const script = document.createElement('script');
      script.src = FANCYBOX_JS;
      script.defer = true;
      document.head.appendChild(script);
    }
  }

  getUrlMediaType(value) {
    const normalized = String(value || '')
      .trim()
      .toLowerCase();
    if (normalized === 'photo' || normalized === 'photos') return 'image';
    if (normalized === 'folders') return 'folder';
    return LEXOR_VALID_MEDIA_TYPES.includes(normalized) ? normalized : '';
  }

  getShareMediaType(type) {
    if (type === 'image') return 'photo';
    return LEXOR_VALID_MEDIA_TYPES.includes(type) ? type : 'all';
  }

  applyStateFromUrlParams() {
    const params = new URLSearchParams(window.location.search || '');
    const nextCategory = (params.get(LEXOR_URL_KEYS.category) || '').trim();
    const nextSub = (params.get(LEXOR_URL_KEYS.subCategory) || '').trim();
    const nextFolder = (
      params.get(LEXOR_URL_KEYS.folder) ||
      params.get(LEXOR_URL_KEYS.folderShort) ||
      ''
    ).trim();
    const nextType = this.getUrlMediaType(params.get(LEXOR_URL_KEYS.mediaType));

    if (nextType) this.state.type = nextType;
    if (!nextCategory) return;

    if (nextCategory === LEXOR_GLOBAL_ALL_CATEGORY || nextCategory === 'all') {
      this.state.category = LEXOR_GLOBAL_ALL_CATEGORY;
      this.state.sub = '';
      this.state.folder = '';
      this.state.folderTitle = '';
      this.state.viewMode = 'all';
      if (this.state.type === 'folder') this.state.type = 'all';
      return;
    }

    const category = this.findCategoryByHandle(nextCategory);
    if (!category) return;

    // ✅ Nếu URL chỉ có category, không có sub → view category-level media
    if (!nextSub) {
      this.state.category = category.handle;
      this.state.sub = '';
      this.state.folder = nextFolder;
      this.state.folderTitle = nextFolder ? this.titleFromHandle(nextFolder) : '';
      this.state.viewMode = 'category';
      return;
    }

    const validSub = this.findSubCategoryByHandle(category.handle, nextSub);
    const firstSub = (category.sub_categories || [])[0] || null;
    const sub = validSub || firstSub;

    if (!sub) {
      // Category không có sub nào → fallback về category view
      this.state.category = category.handle;
      this.state.sub = '';
      this.state.folder = '';
      this.state.folderTitle = '';
      this.state.viewMode = 'category';
      return;
    }

    this.state.category = category.handle;
    this.state.sub = sub.handle;
    this.state.folder = nextFolder;
    this.state.folderTitle = nextFolder ? this.titleFromHandle(nextFolder) : '';
    this.state.viewMode = sub ? 'sub' : 'category';
  }

  updateUrlParams() {
    if (!window.history || !window.history.replaceState) return;

    const url = new URL(window.location.href);

    if (
      this.state.category === LEXOR_GLOBAL_ALL_CATEGORY ||
      !this.state.category
    ) {
      url.searchParams.set(LEXOR_URL_KEYS.category, LEXOR_GLOBAL_ALL_CATEGORY);
      url.searchParams.delete(LEXOR_URL_KEYS.subCategory);
      url.searchParams.delete(LEXOR_URL_KEYS.folder);
      url.searchParams.delete(LEXOR_URL_KEYS.folderShort);
    } else {
      url.searchParams.set(LEXOR_URL_KEYS.category, this.state.category);

      // Chỉ set sub nếu đang ở sub mode
      if (this.state.sub && this.state.viewMode !== 'category') {
        url.searchParams.set(LEXOR_URL_KEYS.subCategory, this.state.sub);
      } else {
        url.searchParams.delete(LEXOR_URL_KEYS.subCategory);
      }

      if (this.state.folder)
        url.searchParams.set(LEXOR_URL_KEYS.folder, this.state.folder);
      else url.searchParams.delete(LEXOR_URL_KEYS.folder);
      url.searchParams.delete(LEXOR_URL_KEYS.folderShort);
    }

    const mediaType = this.getShareMediaType(this.state.type);
    if (mediaType !== 'all') {
      url.searchParams.set(LEXOR_URL_KEYS.mediaType, mediaType);
    } else {
      url.searchParams.delete(LEXOR_URL_KEYS.mediaType);
    }
    url.searchParams.delete('type');

    window.history.replaceState({}, '', url.toString());
  }

  findCategoryByHandle(handle) {
    return (
      this.state.tree.find((category) => category.handle === handle) || null
    );
  }

  findSubCategoryByHandle(categoryHandle, subHandle) {
    const category = this.findCategoryByHandle(categoryHandle);
    return (
      category?.sub_categories?.find((sub) => sub.handle === subHandle) || null
    );
  }

  titleFromHandle(handle) {
    return String(handle || '')
      .split('-')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  getSubTitle() {
    const found = this.state.tree
      .flatMap((category) => category.sub_categories || [])
      .find((sub) => sub.handle === this.state.sub);
    return found?.title || 'Back';
  }

  getActiveTitle() {
    if (this.state.folderTitle) return this.state.folderTitle;
    if (this.state.sub) {
      const found = this.state.tree
        .flatMap((category) => category.sub_categories || [])
        .find((sub) => sub.handle === this.state.sub);
      return found?.title || this.state.sub;
    }
    if (this.state.category === LEXOR_GLOBAL_ALL_CATEGORY) return 'All Media';

    // Lấy title của category khi ở category level
    if (this.state.category && this.state.viewMode === 'category') {
      const category = this.findCategoryByHandle(this.state.category);
      return category?.title || 'Media Gallery';
    }

    const category = this.findCategoryByHandle(this.state.category);
    return category?.title || 'Media Gallery';
  }

  getCrumb() {
    if (this.state.category === LEXOR_GLOBAL_ALL_CATEGORY) return '';

    // ✅ Chỉ show breadcrumb khi đang ở sub hoặc folder
    // Khi ở category-level (không sub, không folder) → không show
    if (!this.state.sub && !this.state.folder) return '';

    const category = this.findCategoryByHandle(this.state.category);
    const sub = category?.sub_categories?.find(
      (item) => item.handle === this.state.sub,
    );
    return [category?.title, sub?.title, this.state.folderTitle]
      .filter(Boolean)
      .join(' / ');
  }

  render() {
    const isReady = this.state.ready;
    this.innerHTML = `
      <section class="media-gallery-section${isReady ? ' is-ready' : ''}" data-media-gallery-section aria-busy="${this.state.loading ? 'true' : 'false'}">
        <div class="media-gallery">
          <div class="media-gallery__layout">
            <aside class="media-gallery__sidebar" aria-label="Media categories">
              ${this.renderSidebar(false)}
            </aside>
            <main class="media-gallery__main">
              <div class="media-gallery__mobile-head">
                <h2 class="media-gallery__title" data-media-title>${this.escape(this.getActiveTitle())}</h2>
              </div>
              <div class="media-gallery__desktop-title-wrap">
                ${this.state.folder ? `<button class="media-gallery__back" type="button" data-action="back-folder">← ${this.escape(this.getSubTitle())}</button>` : ''}
                <h2 class="media-gallery__title" data-media-title-desktop>${this.escape(this.getActiveTitle())}</h2>
                ${this.getCrumb() ? `<p class="media-gallery__breadcrumb">${this.escape(this.getCrumb())}</p>` : ''}
              </div>
              ${this.renderTabs()}
              ${this.renderContent()}
            </main>
          </div>
        </div>
        ${this.renderDrawer()}
        ${this.renderModal()}
      </section>
    `;

    if (this.state.drawerOpen) this.openDrawer();
    this.setupIntersectionObserver();
  }

  setupIntersectionObserver() {
    if (this.observer) {
      this.observer.disconnect();
    }

    if (!this.state.hasMore || this.state.loading) return;

    const sentinel = this.querySelector('[data-media-sentinel]');
    if (!sentinel) return;

    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          console.log('IntersectionObserver triggered: sentinel hit!', entries[0]);
          this.observer.disconnect();
          this.state.page += 1;
          this.loadMedia(false);
        }
      },
      { rootMargin: '200px', threshold: 0 }
    );

    this.observer.observe(sentinel);
  }

  renderSidebar(isDrawer) {
    const activeAll =
      this.state.category === LEXOR_GLOBAL_ALL_CATEGORY && !this.state.sub;
    return `
      <div class="media-sidebar${isDrawer ? ' media-sidebar--drawer' : ''}" data-media-sidebar>
        <button type="button" class="media-sidebar__all-button${activeAll ? ' is-active' : ''}" data-action="select-all" aria-current="${activeAll ? 'true' : 'false'}">
          <span class="media-sidebar__all-icon">${icons.squaresFour}</span>
          <span class="media-sidebar__all-title">All Media</span>
        </button>
        ${this.state.tree.map((category) => this.renderCategoryGroup(category)).join('')}
      </div>
    `;
  }

  renderCategoryGroup(category) {
    const isOpen = this.state.category === category.handle;
    const isActiveCategory = this.state.category === category.handle && !this.state.sub && !this.state.folder;
    const categoryId = `MediaSubmenu-${this.escape(category.handle)}`;

    return `
    <div class="media-sidebar__group${isOpen ? ' is-open' : ''}${isActiveCategory ? ' is-active-category' : ''}" data-sidebar-group data-category-group="${this.escape(category.handle)}">
      <div class="media-sidebar__group-header">
        <button type="button" class="media-sidebar__group-button${isOpen ? ' is-active' : ''}" data-action="select-category" data-category="${this.escape(category.handle)}" aria-current="${isOpen ? 'true' : 'false'}">
          <span class="media-sidebar__group-icon">${category.icon_svg || icons.folder}</span>
          <span class="media-sidebar__group-title">${this.escape(category.title)}</span>
          ${(category.sub_categories || []).length > 0 ? `<span class="media-sidebar__chevron" aria-hidden="true"></span>` : ''}
        </button>
      </div>
      <div id="${categoryId}" class="media-sidebar__submenu" data-sidebar-submenu>
        ${(category.sub_categories || [])
        .map((sub) => `
            <button type="button" class="media-sidebar__submenu-item${this.state.sub === sub.handle ? ' is-active' : ''}" data-action="select-sub" data-sidebar-sub-item data-category="${this.escape(category.handle)}" data-sub="${this.escape(sub.handle)}" data-title="${this.escape(sub.title)}" aria-current="${this.state.sub === sub.handle ? 'true' : 'false'}">
              ${this.escape(sub.title)}
            </button>
          `)
        .join('')}
      </div>
    </div>
  `;
  }

  renderTabs() {
    // const tabs = Boolean(this.state.folders.length)
    //   ?
    //   [
    //     ['all', 'All Media', icons.squaresFour],
    //     ['video', 'Videos', icons.youtubeLogo],
    //     ['image', 'Photos', icons.imageSquare],
    //     ['folder', 'Folders', icons.folderTab],
    //   ]
    //   :
    //   [
    //     ['all', 'All Media', icons.squaresFour],
    //     ['video', 'Videos', icons.youtubeLogo],
    //     ['image', 'Photos', icons.imageSquare],
    //   ];
    const tabs = [
      ['all', 'All Media', icons.squaresFour],
      ['video', 'Videos', icons.youtubeLogo],
      ['image', 'Photos', icons.imageSquare],
      ['folder', 'Folders', icons.folderTab],
    ]

    return `
      <div class="media-tabs-wrapper">
        <div class="media-tabs" role="tablist" aria-label="Media type filter">
          ${tabs
        .map(
          ([type, label, icon]) => `
            <button type="button" class="media-tabs__button${this.state.type === type ? ' is-active' : ''}" data-action="tab" data-media-filter-button data-media-filter="${this.escape(type)}" data-type="${this.escape(type)}" role="tab" aria-selected="${this.state.type === type ? 'true' : 'false'}">
              ${icon}
              <span>${this.escape(label)}</span>
            </button>
          `,
        )
        .join('')}
        </div>
        <button type="button" class="media-gallery__filter-button btn-mobile" data-action="open-drawer" data-media-drawer-open aria-label="Open media filter">
          ${icons.filter}
        </button>
      </div>
    `;
  }

  renderContent() {
    if (this.state.error) {
      return this.renderEmpty('Cannot load gallery', this.state.error, false);
    }

    const showFolders = !this.state.folder && (this.state.type === 'all' || this.state.type === 'folder');
    const showMedia = this.state.type !== 'folder';

    // Chỉ merge khi đang ở tab "All Media" và chưa vào folder cụ thể
    const shouldMerge = this.state.type === 'all' && !this.state.folder;

    let items = [];

    if (shouldMerge && showFolders && showMedia) {
      const folderItems = this.state.folders.map(f => ({ ...f, __kind: 'folder' }));
      const mediaItems = this.state.media.map(m => ({ ...m, __kind: 'media' }));
      items = [...folderItems, ...mediaItems];
    } else {
      if (showFolders) {
        items = this.state.folders.map(f => ({ ...f, __kind: 'folder' }));
      }
      if (showMedia) {
        items = [...items, ...this.state.media.map(m => ({ ...m, __kind: 'media' }))];
      }
    }

    // Keep the API's folder order; sort only loaded media (API paginates in this order).
    items.sort((a, b) => {
      if (a.__kind === 'folder') return b.__kind === 'folder' ? 0 : -1;
      if (b.__kind === 'folder') return 1;

      // YYYY-MM-DD strings compare chronologically without timezone conversion.
      const dateA = a.media_date || '';
      const dateB = b.media_date || '';
      if (dateA !== dateB) return dateA > dateB ? -1 : 1;

      const sortOrder = (a.sort_order ?? 0) - (b.sort_order ?? 0);
      if (sortOrder) return sortOrder;

      const createdA = new Date(a.created_at || 0).getTime() || 0;
      const createdB = new Date(b.created_at || 0).getTime() || 0;
      if (createdA !== createdB) return createdB - createdA;

      const idA = String(a.id ?? '');
      const idB = String(b.id ?? '');
      return idA < idB ? -1 : idA > idB ? 1 : 0;
    });

    const hasItems = items.length > 0;

    if (!hasItems && this.state.loading) {
      return `
      <div class="media-grid" data-media-grid></div>
      ${this.renderLoader(false)}
    `;
    }

    if (!hasItems) {
      return this.renderEmpty(
        'No media found',
        'Try another category, folder, or media type.',
        true,
      );
    }

    return `
    <div class="media-grid" data-media-grid>
      ${items.map((item) => {
      return item.__kind === 'folder'
        ? this.renderFolder(item)
        : this.renderMedia(item);
    }).join('')}
    </div>
    ${this.renderLoader(!this.state.loading)}
    <div class="media-gallery__sentinel" data-media-sentinel style="height: 1px; width: 100%; opacity: 0;">&nbsp;</div>
    ${!this.state.hasMore && hasItems && !this.state.loading ? this.renderEndOfGallery() : ''}
  `;
  }

  renderEndOfGallery() {
    return `
      <div class="media-gallery__end visually-hidden" aria-live="polite">
        <span class="media-gallery__end-icon">✓</span>
        <p class="media-gallery__end-text">You've reached the end of the gallery.</p>
      </div>
      `;
  }

  renderEmpty(title, text, includeIcon) {
    return `
      <div class="media-gallery__empty" data-media-empty>
        ${includeIcon ? `<div class="media-gallery__empty-icon">${icons.empty}</div>` : ''}
        <h3 class="media-gallery__empty-title">${this.escape(title)}</h3>
        <p class="media-gallery__empty-text">${this.escape(text)}</p>
      </div>
      ${this.renderLoader(true)}
    `;
  }

  renderLoader(hidden) {
    return `
      <div class="media-gallery__loader" data-media-loader ${hidden ? 'hidden' : ''} aria-hidden="${hidden ? 'true' : 'false'}">
        <span class="media-gallery__loader-spinner" aria-hidden="true"></span>
        <span>Loading media...</span>
      </div>
    `;
  }

  renderFolder(folder) {
    return `
      <button data-cover-url="${folder.cover_image_url}" type="button" class="media-card media-card--folder" data-action="open-folder" data-folder="${this.escape(folder.handle)}" data-title="${this.escape(folder.title)}" aria-label="Open folder ${this.escape(folder.title)}">
        ${this.renderFolderCover(folder.cover_image_url)}
        <span class="media-card__folder-layer" aria-hidden="true"></span>
        <span class="media-card__folder-icon">${icons.folderLarge}</span>
        <span class="media-card__folder-title">${this.escape(folder.title)}</span>
      </button>
    `;
  }

  renderFolderCover(cover) {
    if (!cover)
      return `<span class="media-card__placeholder">${icons.empty}</span>`;
    const youtubeCover = this.youtubeThumbnail(cover);
    if (youtubeCover) {
      return `<img src="${this.escape(youtubeCover)}" alt="" loading="lazy" decoding="async" width="720" height="405">`;
    }
    if (this.isSelfHostedVideo(cover)) {
      return `<span class="media-card__placeholder">${icons.empty}</span>`;
    }
    return `<img src="${this.escape(cover)}" alt="" loading="lazy" decoding="async" width="720" height="405">`;
  }

  renderMedia(item) {
    const isVideo = item.media_type === 'video';
    const thumb = this.getThumbnail(item);
    return `
      <button type="button" class="media-card media-card--${isVideo ? 'video' : 'photo'}" data-action="open-media" data-id="${this.escape(item.id)}" data-caption="${this.escape(item.title || '')}" aria-label="Open ${this.escape(item.title || 'media')}">
        ${this.renderMediaThumb(item, thumb)}
        ${isVideo ? `<span class="media-card__video-layer" aria-hidden="true"></span><span class="media-card__play">${icons.playCircle}</span>` : ''}
      </button>
    `;
  }

  renderMediaThumb(item, thumb) {
    if (thumb) {
      return `<img src="${this.escape(thumb)}" alt="${this.escape(item.alt || item.title || '')}" loading="lazy" decoding="async" width="720" height="405">`;
    }
    return `<span class="media-card__placeholder">${icons.empty}</span>`;
  }

  renderDrawer() {
    return `
      <div class="media-drawer-overlay${this.state.drawerOpen ? ' is-open' : ''}" data-action="close-drawer" data-media-drawer-overlay ${this.state.drawerOpen ? '' : 'hidden'}></div>
      <aside class="media-drawer${this.state.drawerOpen ? ' is-open' : ''}" data-media-drawer ${this.state.drawerOpen ? '' : 'hidden'} aria-hidden="${this.state.drawerOpen ? 'false' : 'true'}">
        <div class="media-drawer__header">
          <span>Filter</span>
          <button type="button" class="media-drawer__close" data-action="close-drawer" data-media-drawer-close aria-label="Close media filter">×</button>
        </div>
        ${this.renderSidebar(true)}
      </aside>
    `;
  }

  renderModal() {
    const item = this.state.modal;
    if (!item) return '<div class="media-modal" hidden></div>';

    return `
      <div class="media-modal is-open" data-action="close-modal">
        <div class="media-modal__inner" onclick="event.stopPropagation()">
          <div class="media-modal__header">
            <h3 class="media-modal__title">${this.escape(item.title || '')}</h3>
            <button type="button" class="media-drawer__close" data-action="close-modal" aria-label="Close media preview">×</button>
          </div>
          <div class="media-modal__body">${this.renderModalBody(item)}</div>
        </div>
      </div>
    `;
  }

  renderModalBody(item) {
    if (item.media_type === 'image') {
      return `<img src="${this.escape(item.url)}" alt="${this.escape(item.alt || item.title || '')}" width="1200" height="800">`;
    }

    if (item.source_type === 'youtube') {
      const id = this.youtubeId(item.url);
      if (id) {
        return `<iframe src="https://www.youtube.com/embed/${this.escape(id)}?autoplay=1" title="${this.escape(item.title || 'Video')}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
      }
    }

    return `<video src="${this.escape(item.url)}" controls autoplay playsinline></video>`;
  }

  getThumbnail(item) {
    if (item.thumbnail_url) return item.thumbnail_url;
    if (item.media_type === 'image') return item.url;
    if (item.source_type === 'youtube') return this.youtubeThumbnail(item.url);
    return '';
  }

  youtubeThumbnail(url) {
    const id = this.youtubeId(url);
    return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : '';
  }

  youtubeId(url) {
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.hostname.includes('youtu.be')) {
        return parsedUrl.pathname.split('/').filter(Boolean)[0] || '';
      }
      if (parsedUrl.hostname.includes('youtube') && parsedUrl.searchParams.get('v'))
        return parsedUrl.searchParams.get('v');
      const parts = parsedUrl.pathname.split('/').filter(Boolean);
      const index = parts.findIndex((part) =>
        ['embed', 'shorts', 'live'].includes(part),
      );
      return index >= 0 ? parts[index + 1] || '' : '';
    } catch {
      return '';
    }
  }

  isSelfHostedVideo(url) {
    return /\.(mp4|m4v|mov|webm|ogv)(\?|#|$)/i.test(url || '');
  }

  escape(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }
}

const icons = {
  squaresFour:
    '<svg class="media-icon media-icon--squares-four" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"> <path d="M9.75 3.75H5.25C4.85218 3.75 4.47064 3.90804 4.18934 4.18934C3.90804 4.47064 3.75 4.85218 3.75 5.25V9.75C3.75 10.1478 3.90804 10.5294 4.18934 10.8107C4.47064 11.092 4.85218 11.25 5.25 11.25H9.75C10.1478 11.25 10.5294 11.092 10.8107 10.8107C11.092 10.5294 11.25 10.1478 11.25 9.75V5.25C11.25 4.85218 11.092 4.47064 10.8107 4.18934C10.5294 3.90804 10.1478 3.75 9.75 3.75ZM9.75 9.75H5.25V5.25H9.75V9.75ZM18.75 3.75H14.25C13.8522 3.75 13.4706 3.90804 13.1893 4.18934C12.908 4.47064 12.75 4.85218 12.75 5.25V9.75C12.75 10.1478 12.908 10.5294 13.1893 10.8107C13.4706 11.092 13.8522 11.25 14.25 11.25H18.75C19.1478 11.25 19.5294 11.092 19.8107 10.8107C20.092 10.5294 20.25 10.1478 20.25 9.75V5.25C20.25 4.85218 20.092 4.47064 19.8107 4.18934C19.5294 3.90804 19.1478 3.75 18.75 3.75ZM18.75 9.75H14.25V5.25H18.75V9.75ZM9.75 12.75H5.25C4.85218 12.75 4.47064 12.908 4.18934 13.1893C3.90804 13.4706 3.75 13.8522 3.75 14.25V18.75C3.75 19.1478 3.90804 19.5294 4.18934 19.8107C4.47064 20.092 4.85218 20.25 5.25 20.25H9.75C10.1478 20.25 10.5294 20.092 10.8107 19.8107C11.092 19.5294 11.25 19.1478 11.25 18.75V14.25C11.25 13.8522 11.092 13.4706 10.8107 13.1893C10.5294 12.908 10.1478 12.75 9.75 12.75ZM9.75 18.75H5.25V14.25H9.75V18.75ZM18.75 12.75H14.25C13.8522 12.75 13.4706 12.908 13.1893 13.1893C12.908 13.4706 12.75 13.8522 12.75 14.25V18.75C12.75 19.1478 12.908 19.5294 13.1893 19.8107C13.4706 20.092 13.8522 20.25 14.25 20.25H18.75C19.1478 20.25 19.5294 20.092 19.8107 19.8107C20.092 19.5294 20.25 19.1478 20.25 18.75V14.25C20.25 13.8522 20.092 13.4706 19.8107 13.1893C19.5294 12.908 19.1478 12.75 18.75 12.75ZM18.75 18.75H14.25V14.25H18.75V18.75Z" fill="currentColor"></path> </svg>',
  youtubeLogo:
    '<svg class="media-icon media-icon--youtube" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"> <path d="M15.4163 11.3756L10.9163 8.37563C10.8033 8.30025 10.6719 8.25697 10.5363 8.2504C10.4006 8.24382 10.2657 8.27421 10.146 8.33831C10.0263 8.40241 9.92619 8.49783 9.85645 8.61436C9.7867 8.7309 9.74991 8.86419 9.75 9V15C9.74991 15.1358 9.7867 15.2691 9.85645 15.3856C9.92619 15.5022 10.0263 15.5976 10.146 15.6617C10.2657 15.7258 10.4006 15.7562 10.5363 15.7496C10.6719 15.743 10.8033 15.6998 10.9163 15.6244L15.4163 12.6244C15.5191 12.5559 15.6035 12.4631 15.6618 12.3542C15.7202 12.2452 15.7507 12.1236 15.7507 12C15.7507 11.8764 15.7202 11.7548 15.6618 11.6458C15.6035 11.5369 15.5191 11.4441 15.4163 11.3756ZM11.25 13.5984V10.4063L13.6481 12L11.25 13.5984ZM21.9684 6.5175C21.8801 6.17189 21.7109 5.85224 21.4747 5.58491C21.2385 5.31758 20.9421 5.11024 20.61 4.98C17.3962 3.73875 12.2812 3.75 12 3.75C11.7188 3.75 6.60375 3.73875 3.39 4.98C3.0579 5.11024 2.76153 5.31758 2.52534 5.58491C2.28915 5.85224 2.1199 6.17189 2.03156 6.5175C1.78875 7.45313 1.5 9.16313 1.5 12C1.5 14.8369 1.78875 16.5469 2.03156 17.4825C2.11977 17.8283 2.28895 18.1481 2.52515 18.4156C2.76136 18.6831 3.0578 18.8906 3.39 19.0209C6.46875 20.2088 11.2875 20.25 11.9381 20.25H12.0619C12.7125 20.25 17.5341 20.2088 20.61 19.0209C20.9422 18.8906 21.2386 18.6831 21.4748 18.4156C21.711 18.1481 21.8802 17.8283 21.9684 17.4825C22.2113 16.545 22.5 14.8369 22.5 12C22.5 9.16313 22.2113 7.45313 21.9684 6.5175ZM20.5162 17.1113C20.4877 17.2263 20.4323 17.3329 20.3545 17.4224C20.2768 17.5118 20.179 17.5816 20.0691 17.6259C17.1019 18.7716 12.0553 18.7509 12.0066 18.7509H12C11.9494 18.7509 6.90656 18.7697 3.9375 17.6259C3.8276 17.5816 3.72977 17.5118 3.65204 17.4224C3.57431 17.3329 3.51888 17.2263 3.49031 17.1113C3.2625 16.2553 3 14.6784 3 12C3 9.32157 3.2625 7.74469 3.48375 6.89344C3.51179 6.77774 3.56697 6.67037 3.64473 6.58022C3.7225 6.49007 3.8206 6.41972 3.93094 6.375C6.79219 5.26969 11.5866 5.25 11.9794 5.25H12.0047C12.0553 5.25 17.1028 5.23313 20.0672 6.375C20.1771 6.41936 20.2749 6.48913 20.3526 6.57859C20.4304 6.66806 20.4858 6.77467 20.5144 6.88969C20.7375 7.74469 21 9.32157 21 12C21 14.6784 20.7375 16.2553 20.5162 17.1066V17.1113Z" fill="currentColor"></path> </svg>',
  imageSquare:
    '<svg class="media-icon media-icon--image-square" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M19.5 3H4.5C4.10218 3 3.72064 3.15804 3.43934 3.43934C3.15804 3.72064 3 4.10218 3 4.5V19.5C3 19.8978 3.15804 20.2794 3.43934 20.5607C3.72064 20.842 4.10218 21 4.5 21H19.5C19.8978 21 20.2794 20.842 20.5607 20.5607C20.842 20.2794 21 19.8978 21 19.5V4.5C21 4.10218 20.842 3.72064 20.5607 3.43934C20.2794 3.15804 19.8978 3 19.5 3ZM4.5 4.5H19.5V11.7544L17.1853 9.43875C16.904 9.15766 16.5227 8.99976 16.125 8.99976C15.7273 8.99976 15.346 9.15766 15.0647 9.43875L5.00344 19.5H4.5V4.5ZM19.5 19.5H7.125L16.125 10.5L19.5 13.875V19.5ZM9 11.25C9.44501 11.25 9.88002 11.118 10.25 10.8708C10.62 10.6236 10.9084 10.2722 11.0787 9.86104C11.249 9.4499 11.2936 8.9975 11.2068 8.56105C11.12 8.12459 10.9057 7.72368 10.591 7.40901C10.2763 7.09434 9.87541 6.88005 9.43895 6.79323C9.0025 6.70642 8.5501 6.75097 8.13896 6.92127C7.72783 7.09157 7.37643 7.37996 7.12919 7.74997C6.88196 8.11998 6.75 8.55499 6.75 9C6.75 9.59674 6.98705 10.169 7.40901 10.591C7.83097 11.0129 8.40326 11.25 9 11.25ZM9 8.25C9.14834 8.25 9.29334 8.29399 9.41668 8.3764C9.54001 8.45881 9.63614 8.57594 9.69291 8.71299C9.74968 8.85003 9.76453 9.00083 9.73559 9.14632C9.70665 9.2918 9.63522 9.42544 9.53033 9.53033C9.42544 9.63522 9.2918 9.70665 9.14632 9.73559C9.00083 9.76453 8.85003 9.74968 8.71299 9.69291C8.57594 9.63614 8.45881 9.54001 8.3764 9.41668C8.29399 9.29334 8.25 9.14834 8.25 9C8.25 8.80109 8.32902 8.61032 8.46967 8.46967C8.61032 8.32902 8.80109 8.25 9 8.25Z" fill="currentColor"></path></svg>',
  filter:
    '<svg class="media-icon media-icon--filter"viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"></path><circle cx="16" cy="7" r="2"></circle><circle cx="8" cy="17" r="2"></circle></svg>',
  folder:
    '<svg class="media-icon media-icon--folder" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" xmlns="http://www.w3.org/2000/svg"><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10L12 7H18.5A2.5 2.5 0 0 1 21 9.5V16.5A2.5 2.5 0 0 1 18.5 19H5.5A2.5 2.5 0 0 1 3 16.5V7.5Z"/></svg>',
  folderTab:
    '<svg class="media-icon media-icon--folder-tab" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" xmlns="http://www.w3.org/2000/svg"><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10L12 7H18.5A2.5 2.5 0 0 1 21 9.5V16.5A2.5 2.5 0 0 1 18.5 19H5.5A2.5 2.5 0 0 1 3 16.5V7.5Z"/></svg>',
  folderLarge:
    '<svg class="media-icon media-icon--folder-large" xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="64" height="64" viewBox="0 0 72 72"> <path d="M 19 13 C 14.037 13 10 17.038 10 22 L 10 49 C 10 49.217 10.017203 49.431531 10.033203 49.644531 L 15.496094 35.582031 C 17.286094 30.976031 21.636125 28 26.578125 28 L 59.988281 28 C 60.673281 28 61.343 28.086703 62 28.220703 L 62 26 C 62 21.038 57.963 17 53 17 L 32.753906 17 C 32.526906 17 32.307813 16.923203 32.132812 16.783203 L 29.869141 14.974609 C 28.280141 13.701609 26.283094 13 24.246094 13 L 19 13 z M 26.578125 32 C 23.299125 32 20.412609 33.97525 19.224609 37.03125 L 12.263672 54.947266 C 13.914672 56.814266 16.318 58 19 58 L 53.1875 58 C 56.5105 58 59.437531 55.998438 60.644531 52.898438 L 65.591797 40.173828 C 66.308797 38.326828 66.070172 36.247328 64.951172 34.611328 C 64.770172 34.346328 62.886281 32 59.988281 32 L 26.578125 32 z"></path> </svg>',
  playCircle:
    '<svg class="media-icon media-icon--play-circle" viewBox="0 0 24 24" width="36" height="36" fill="currentColor"><path d="M8 5v14l11-7z"></path></svg>',
  empty:
    '<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg"> <rect x="18" y="28" width="84" height="60" rx="6" stroke="currentColor" stroke-width="3"></rect> <path d="M31 75L48 58L63 73L72 64L90 82" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path> <circle cx="77" cy="45" r="7" stroke="currentColor" stroke-width="3"></circle> <path d="M43 99H77" stroke="currentColor" stroke-width="3" stroke-linecap="round"></path> <path d="M54 88L50 99" stroke="currentColor" stroke-width="3" stroke-linecap="round"></path> <path d="M66 88L70 99" stroke="currentColor" stroke-width="3" stroke-linecap="round"></path> </svg>',
};

if (!customElements.get('lexor-media-gallery')) {
  customElements.define('lexor-media-gallery', LexorMediaGallery);
}
