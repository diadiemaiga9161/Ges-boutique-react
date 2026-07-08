type L = 'fr' | 'en' | 'ar' | 'wo' | 'bm' | 'ff' | 'sw' | 'pt';

const T: Record<string, Partial<Record<L, string>>> = {
  // ── Login ──────────────────────────────────────────────────────────────────
  connexion:         { fr: 'Connexion',             en: 'Sign In',             ar: 'تسجيل الدخول',      wo: 'Dugg',           bm: 'Segin',        ff: 'Naatirde',       sw: 'Ingia',                   pt: 'Entrar' },
  sub_connexion:     { fr: 'Accédez à votre espace boutique', en: 'Access your shop space', ar: 'الوصول إلى مساحة متجرك', wo: 'Dugg ci sa espas boutique', bm: 'I ka boutique yɔrɔ sɔrɔ', ff: 'Naatir e dow maa', sw: 'Fikia nafasi yako ya duka', pt: 'Acesse seu espaço de boutique' },
  identifiant:       { fr: 'Identifiant',            en: 'Username / Email',    ar: 'المعرف',            wo: 'Turu',           bm: 'Tɔgɔ',        ff: 'Innde',          sw: 'Kitambulisho',            pt: 'Identificador' },
  placeholder_id:    { fr: "Email, téléphone ou nom d'utilisateur", en: 'Email, phone or username', ar: 'البريد أو الهاتف أو الاسم', wo: 'Email, telefon walla tur', bm: 'Email, telefɔni wala tɔgɔ', ff: 'Iimeel, telefon naa innde', sw: 'Barua pepe, simu au jina', pt: 'Email, telefone ou nome' },
  mot_de_passe:      { fr: 'Mot de passe',           en: 'Password',            ar: 'كلمة المرور',       wo: 'Xam-xam bu sëkk', bm: 'Gundo',       ff: 'Njuɓɓudi',       sw: 'Nenosiri',                pt: 'Senha' },
  placeholder_pwd:   { fr: 'Votre mot de passe',     en: 'Your password',       ar: 'كلمة المرور',       wo: 'Sa xam-xam bu sëkk', bm: 'I gundo',  ff: 'Njuɓɓudi maa',  sw: 'Nenosiri lako',           pt: 'A sua senha' },
  se_connecter:      { fr: 'Se connecter',            en: 'Sign In',             ar: 'تسجيل الدخول',      wo: 'Dugg',           bm: 'Segin',        ff: 'Naatir',         sw: 'Ingia',                   pt: 'Entrar' },
  mdp_oublie:        { fr: 'Mot de passe oublié ?',  en: 'Forgot password?',    ar: 'نسيت كلمة المرور؟', wo: 'Xam-xam wecci?', bm: 'Gundo mà kɔrɔba?', ff: 'Njuɓɓudi yejii?', sw: 'Umesahau nenosiri?',  pt: 'Esqueceu a senha?' },
  erreur:            { fr: 'Erreur',                  en: 'Error',               ar: 'خطأ',               wo: 'Njuumte',        bm: 'Fili',         ff: 'Juumre',         sw: 'Hitilafu',                pt: 'Erro' },
  remplir_champs:    { fr: 'Remplis tous les champs', en: 'Fill in all fields',  ar: 'يرجى ملء جميع الحقول', wo: 'Soxal yépp li', bm: 'Yɔrɔ bɛɛ ci', ff: 'Huyto ko fof',  sw: 'Jaza sehemu zote',        pt: 'Preencha todos os campos' },
  connexion_echouee: { fr: 'Connexion échouée',       en: 'Login failed',        ar: 'فشل تسجيل الدخول',  wo: 'Dugg dafay laal', bm: 'Segin ma diya', ff: 'Naatirde waawaay', sw: 'Kuingia kumeshindwa',  pt: 'Falha no login' },
  serveur_inaccessible: { fr: 'Serveur non joignable. Vérifiez votre connexion internet.', en: 'Server unreachable. Check your internet.', ar: 'الخادم غير متاح. تحقق من الإنترنت.', wo: 'Serveur bul gën a tann. Xool sa connexion.', bm: 'Serveur ma sɔrɔ. Internet jɛ.', ff: 'Serveur jaɓɓataa. Internet haaɗ.', sw: 'Seva haifikiwi. Angalia intaneti.', pt: 'Servidor inacessível. Verifique a internet.' },
  identifiants_incorrects: { fr: 'Identifiants incorrects', en: 'Incorrect credentials', ar: 'بيانات غير صحيحة', wo: 'Turu bi feeñ', bm: 'Tɔgɔ ka fili', ff: 'Innde ɓuraa', sw: 'Kitambulisho kibaya', pt: 'Credenciais incorretas' },

  // ── Boutique select ────────────────────────────────────────────────────────
  selectionnez_boutique: { fr: 'Sélectionnez votre boutique', en: 'Select your shop', ar: 'اختر متجرك', wo: 'Tanu sa boutique', bm: 'I ka boutique sugandi', ff: 'Suɓ duunde maa', sw: 'Chagua duka lako', pt: 'Selecione sua boutique' },

  // ── Menu / Navigation ──────────────────────────────────────────────────────
  vente:       { fr: 'Vente',       en: 'Sales',        ar: 'المبيعات',   wo: 'Jaay',      bm: 'Jaara',   ff: 'Mbelgaaji', sw: 'Mauzo',     pt: 'Vendas' },
  produits:    { fr: 'Produits',    en: 'Products',     ar: 'المنتجات',   wo: 'Benn-benn', bm: 'Joli',    ff: 'Dewe',      sw: 'Bidhaa',    pt: 'Produtos' },
  rapports:    { fr: 'Rapports',    en: 'Reports',      ar: 'التقارير',   wo: 'Wax-waxu',  bm: 'Kunnafoniko', ff: 'Limooje', sw: 'Ripoti', pt: 'Relatórios' },
  menu:        { fr: 'Menu',        en: 'Menu',         ar: 'القائمة',    wo: 'Listu',     bm: 'Listu',   ff: 'Listu',     sw: 'Menyu',     pt: 'Menu' },
  clients:     { fr: 'Clients',     en: 'Clients',      ar: 'العملاء',    wo: 'Jëkël',     bm: 'Ciden',   ff: 'Kiliyaaɓe', sw: 'Wateja',    pt: 'Clientes' },
  fournisseurs:{ fr: 'Fournisseurs',en: 'Suppliers',    ar: 'الموردون',   wo: 'Joxkat',    bm: 'Jawulɔ',  ff: 'Yoɓooɓe',  sw: 'Wasambazaji', pt: 'Fornecedores' },
  depenses:    { fr: 'Dépenses',    en: 'Expenses',     ar: 'المصروفات',  wo: 'Yóbbu',     bm: 'Fali',    ff: 'Ɓatuɗe',   sw: 'Matumizi',  pt: 'Despesas' },
  credits:     { fr: 'Crédits',     en: 'Credits',      ar: 'الائتمان',   wo: 'Jënd ak yar', bm: 'Nanu', ff: 'Ɓolɗe',    sw: 'Mikopo',    pt: 'Créditos' },
  caisse:      { fr: 'Caisse',      en: 'Cash',         ar: 'الصندوق',    wo: 'Caisse',    bm: 'Wari',    ff: 'Sariyaaji', sw: 'Fedha',     pt: 'Caixa' },
  inventaire:  { fr: 'Inventaire',  en: 'Inventory',    ar: 'المخزون',    wo: 'Njëkk weur', bm: 'Joli cogoya', ff: 'Ndeewoore', sw: 'Hesabu',  pt: 'Inventário' },
  commandes:   { fr: 'Commandes',   en: 'Orders',       ar: 'الطلبات',    wo: 'Commandes', bm: 'Baara',   ff: 'Jaaɓirɗe', sw: 'Maagizo',   pt: 'Pedidos' },
  transferts:  { fr: 'Transferts',  en: 'Transfers',    ar: 'التحويلات',  wo: 'Yëbël',     bm: 'Yiriɛ',   ff: 'Nafooje',   sw: 'Uhamishaji', pt: 'Transferências' },
  deconnexion: { fr: 'Déconnexion', en: 'Logout',       ar: 'تسجيل الخروج', wo: 'Génn', bm: 'Bɔ',     ff: 'Yaltude',   sw: 'Ondoka',    pt: 'Sair' },
  parametres:  { fr: 'Paramètres',  en: 'Settings',     ar: 'الإعدادات',  wo: 'Reggal',    bm: 'Sɔrɔni', ff: 'Sikkinaaji', sw: 'Mipangilio', pt: 'Configurações' },
};

export function tr(key: string, lang: string): string {
  const entry = T[key];
  if (!entry) return key;
  return entry[lang as L] ?? entry['fr'] ?? key;
}
