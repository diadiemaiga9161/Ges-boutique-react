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

  // ── Clients ────────────────────────────────────────────────────────────────
  recherche_client:  { fr: 'Rechercher un client...', en: 'Search client...', ar: 'ابحث عن عميل...', wo: 'Seet jëkël...', bm: 'Ciden ɲini...', ff: 'Yiylo kiliyel...', sw: 'Tafuta mteja...', pt: 'Procurar cliente...' },
  nouveau_client:    { fr: 'Nouveau client', en: 'New client', ar: 'عميل جديد', wo: 'Jëkël bu bees', bm: 'Ciden kura', ff: 'Kiliyel keso', sw: 'Mteja mpya', pt: 'Novo cliente' },
  nom_client:        { fr: 'Nom *', en: 'Name *', ar: 'الاسم *', wo: 'Turu *', bm: 'Tɔgɔ *', ff: 'Innde *', sw: 'Jina *', pt: 'Nome *' },
  telephone:         { fr: 'Téléphone', en: 'Phone', ar: 'الهاتف', wo: 'Telefon', bm: 'Telefɔni', ff: 'Telefon', sw: 'Simu', pt: 'Telefone' },
  email:             { fr: 'Email', en: 'Email', ar: 'البريد الإلكتروني', wo: 'Email', bm: 'Email', ff: 'Iimeel', sw: 'Barua pepe', pt: 'Email' },
  adresse:           { fr: 'Adresse', en: 'Address', ar: 'العنوان', wo: 'Adresse', bm: 'Adresse', ff: 'Adresse', sw: 'Anwani', pt: 'Endereço' },
  solde_credit:      { fr: 'Solde crédit', en: 'Credit balance', ar: 'رصيد الائتمان', wo: 'Solde crédit', bm: 'Nanu wari', ff: 'Ɓolɗe wari', sw: 'Salio la mkopo', pt: 'Saldo de crédito' },
  aucun_client:      { fr: 'Aucun client trouvé', en: 'No client found', ar: 'لا يوجد عملاء', wo: 'Amul jëkël', bm: 'Ciden ma sɔrɔ', ff: 'Alaa kiliyel', sw: 'Hakuna mteja', pt: 'Nenhum cliente encontrado' },

  // ── Credits ────────────────────────────────────────────────────────────────
  credits_clients:   { fr: 'Crédits clients', en: 'Client credits', ar: 'ائتمان العملاء', wo: 'Crédits jëkël', bm: 'Ciden nanu', ff: 'Kiliyaaɓe ɓolɗe', sw: 'Mikopo ya wateja', pt: 'Créditos de clientes' },
  montant:           { fr: 'Montant', en: 'Amount', ar: 'المبلغ', wo: 'Xaalis', bm: 'Wari', ff: 'Njuɓɓudi', sw: 'Kiasi', pt: 'Valor' },
  regle:             { fr: 'Réglé', en: 'Paid', ar: 'مدفوع', wo: 'Pay na', bm: 'Fali na', ff: 'Jaɓɓaa', sw: 'Imelipwa', pt: 'Pago' },
  non_regle:         { fr: 'Non réglé', en: 'Unpaid', ar: 'غير مدفوع', wo: 'Pay woo', bm: 'Fali woo', ff: 'Jaɓɓaaka', sw: 'Haijalipiwa', pt: 'Não pago' },
  payer_credit:      { fr: 'Payer', en: 'Pay', ar: 'ادفع', wo: 'Pay', bm: 'Fali', ff: 'Jaɓɓir', sw: 'Lipa', pt: 'Pagar' },
  montant_payer:     { fr: 'Montant à payer', en: 'Amount to pay', ar: 'المبلغ المطلوب', wo: 'Xaalis bu pay', bm: 'Fali wari', ff: 'Wari jaɓɓirteeɗo', sw: 'Kiasi cha kulipa', pt: 'Valor a pagar' },
  reste_a_payer:     { fr: 'Reste à payer', en: 'Remaining to pay', ar: 'المتبقي للدفع', wo: 'Tollu ci pay', bm: 'Tɔɔ fali', ff: 'Haɗɗe jaɓɓude', sw: 'Kilichobaki kulipwa', pt: 'Restante a pagar' },
  date:              { fr: 'Date', en: 'Date', ar: 'التاريخ', wo: 'Date', bm: 'Date', ff: 'Date', sw: 'Tarehe', pt: 'Data' },

  // ── Depenses ───────────────────────────────────────────────────────────────
  nouvelle_depense:  { fr: 'Nouvelle dépense', en: 'New expense', ar: 'مصروف جديد', wo: 'Yóbbu bu bees', bm: 'Fali kura', ff: 'Ɓatuɗal keso', sw: 'Gharama mpya', pt: 'Nova despesa' },
  description:       { fr: 'Description', en: 'Description', ar: 'الوصف', wo: 'Description', bm: 'Kunnafoniko', ff: 'Jaaynde', sw: 'Maelezo', pt: 'Descrição' },
  type_depense:      { fr: 'Type de dépense', en: 'Expense type', ar: 'نوع المصروف', wo: 'Xam-xam yóbbu', bm: 'Fali jɔli', ff: 'Lenyol ɓatuɗal', sw: 'Aina ya gharama', pt: 'Tipo de despesa' },
  aucune_depense:    { fr: 'Aucune dépense', en: 'No expenses', ar: 'لا توجد مصروفات', wo: 'Amul yóbbu', bm: 'Fali ma sɔrɔ', ff: 'Alaa ɓatuɗe', sw: 'Hakuna gharama', pt: 'Nenhuma despesa' },

  // ── Fournisseurs ───────────────────────────────────────────────────────────
  recherche_fournisseur: { fr: 'Rechercher...', en: 'Search...', ar: 'بحث...', wo: 'Seet...', bm: 'Ɲini...', ff: 'Yiylo...', sw: 'Tafuta...', pt: 'Procurar...' },
  nouveau_fournisseur:{ fr: 'Nouveau fournisseur', en: 'New supplier', ar: 'مورد جديد', wo: 'Joxkat bu bees', bm: 'Jawulɔ kura', ff: 'Yoɓooɓe keso', sw: 'Msambazaji mpya', pt: 'Novo fornecedor' },
  nom_fournisseur:   { fr: 'Nom *', en: 'Name *', ar: 'الاسم *', wo: 'Turu *', bm: 'Tɔgɔ *', ff: 'Innde *', sw: 'Jina *', pt: 'Nome *' },
  dette:             { fr: 'Dette', en: 'Debt', ar: 'الدين', wo: 'Dett', bm: 'Nanu', ff: 'Ɓolal', sw: 'Deni', pt: 'Dívida' },
  payer_fournisseur: { fr: 'Payer', en: 'Pay', ar: 'ادفع', wo: 'Pay', bm: 'Fali', ff: 'Jaɓɓir', sw: 'Lipa', pt: 'Pagar' },
  achat:             { fr: 'Achat', en: 'Purchase', ar: 'شراء', wo: 'Jënd', bm: 'Jɔlili', ff: 'Soodude', sw: 'Ununuzi', pt: 'Compra' },

  // ── Rapports ───────────────────────────────────────────────────────────────
  rapport_journalier:{ fr: 'Rapport journalier', en: 'Daily report', ar: 'التقرير اليومي', wo: 'Rapport bu bés', bm: 'Kunnafoniko fanw', ff: 'Limoore hannde', sw: 'Ripoti ya kila siku', pt: 'Relatório diário' },
  rapport_semaine:   { fr: 'Cette semaine', en: 'This week', ar: 'هذا الأسبوع', wo: 'Ayubés bii', bm: 'Dɔgɔkun in', ff: 'Yontere ndee', sw: 'Wiki hii', pt: 'Esta semana' },
  rapport_mois:      { fr: 'Ce mois', en: 'This month', ar: 'هذا الشهر', wo: 'Weer bii', bm: 'Kalo in', ff: 'Lewru nduu', sw: 'Mwezi huu', pt: 'Este mês' },
  chiffre_affaires:  { fr: "Chiffre d'affaires", en: 'Revenue', ar: 'رقم الأعمال', wo: 'CA bi', bm: 'Jaara', ff: 'CA', sw: 'Mapato', pt: 'Faturamento' },
  benefice:          { fr: 'Bénéfice', en: 'Profit', ar: 'الربح', wo: 'Jëm ak njëm', bm: 'Nafa', ff: 'Nafaaji', sw: 'Faida', pt: 'Lucro' },
  nb_ventes:         { fr: 'Nb. ventes', en: 'Nb. sales', ar: 'عدد المبيعات', wo: 'Benn-benn yi', bm: 'Jaara murun', ff: 'Mbelgaaji', sw: 'Idadi ya mauzo', pt: 'Nº de vendas' },

  // ── Caisse ─────────────────────────────────────────────────────────────────
  ouvrir_caisse:     { fr: 'Ouvrir la caisse', en: 'Open cash register', ar: 'فتح الصندوق', wo: 'Ëmb caisse bi', bm: 'Wari sɔrɔni ɲɛ', ff: 'Udditirde caisse', sw: 'Fungua pesa', pt: 'Abrir caixa' },
  fermer_caisse:     { fr: 'Fermer la caisse', en: 'Close cash register', ar: 'إغلاق الصندوق', wo: 'Dëkk caisse bi', bm: 'Wari sɔrɔni dafali', ff: 'Udditirde caisse', sw: 'Funga pesa', pt: 'Fechar caixa' },
  solde_initial:     { fr: 'Solde initial', en: 'Opening balance', ar: 'الرصيد الافتتاحي', wo: 'Solde bu tànn', bm: 'Daminɛ wari', ff: 'Wari kawtal', sw: 'Salio la mwanzo', pt: 'Saldo inicial' },
  entree:            { fr: 'Entrée', en: 'Income', ar: 'دخل', wo: 'Dëkk', bm: 'Bɔ', ff: 'Naatde', sw: 'Mapato', pt: 'Entrada' },
  sortie:            { fr: 'Sortie', en: 'Expense', ar: 'خروج', wo: 'Génn', bm: 'Bɔ', ff: 'Yaltude', sw: 'Matumizi', pt: 'Saída' },
  solde_actuel:      { fr: 'Solde actuel', en: 'Current balance', ar: 'الرصيد الحالي', wo: 'Solde bi ci kanam', bm: 'Wari bi kɔni', ff: 'Wari ɓooɗɗo', sw: 'Salio la sasa', pt: 'Saldo atual' },

  // ── Communs ────────────────────────────────────────────────────────────────
  chargement:        { fr: 'Chargement...', en: 'Loading...', ar: 'جارٍ التحميل...', wo: 'Charger...', bm: 'Di don sɔrɔ...', ff: 'Nde soodee...', sw: 'Inapakia...', pt: 'Carregando...' },
  fermer:            { fr: 'Fermer', en: 'Close', ar: 'إغلاق', wo: 'Dëkk', bm: 'Dafali', ff: 'Udditir', sw: 'Funga', pt: 'Fechar' },
  confirmer:         { fr: 'Confirmer', en: 'Confirm', ar: 'تأكيد', wo: 'Dëkk', bm: 'Dafali', ff: 'Seerndude', sw: 'Thibitisha', pt: 'Confirmar' },
  details:           { fr: 'Détails', en: 'Details', ar: 'التفاصيل', wo: 'Xam-xam yu xóot', bm: 'Kunnafoni', ff: 'Siifannde', sw: 'Maelezo', pt: 'Detalhes' },
  aucun_resultat:    { fr: 'Aucun résultat', en: 'No results', ar: 'لا توجد نتائج', wo: 'Amul dara', bm: 'Ma sɔrɔ', ff: 'Alaa ko sɔɓi', sw: 'Hakuna matokeo', pt: 'Nenhum resultado' },
  factures:          { fr: 'Factures', en: 'Invoices', ar: 'الفواتير', wo: 'Factures', bm: 'Factures', ff: 'Factures', sw: 'Ankara', pt: 'Faturas' },
  promotions_titre:  { fr: 'Promotions', en: 'Promotions', ar: 'العروض', wo: 'Promotions', bm: 'Promotions', ff: 'Promotions', sw: 'Matangazo', pt: 'Promoções' },
  notifications:     { fr: 'Notifications', en: 'Notifications', ar: 'الإشعارات', wo: 'Notifications', bm: 'Notifications', ff: 'Notifications', sw: 'Arifa', pt: 'Notificações' },

  // ── Langue ────────────────────────────────────────────────────────────────
  choisir_langue:      { fr: 'Choisir la langue', en: 'Choose language', ar: 'اختر اللغة', wo: 'Tanu làkk bi', bm: 'Kan sugandi', ff: 'Suɓ haala', sw: 'Chagua lugha', pt: 'Escolher idioma' },
  selectionner_langue: { fr: 'Sélectionnez votre langue préférée', en: 'Select your preferred language', ar: 'اختر لغتك المفضلة', wo: 'Tanu sa làkk', bm: 'I kan sugandi', ff: 'Suɓ haala maa', sw: 'Chagua lugha unayoipenda', pt: 'Selecione seu idioma preferido' },

  // ── Menu extras ────────────────────────────────────────────────────────────
  historique_ventes:   { fr: 'Historique des ventes', en: 'Sales history', ar: 'سجل المبيعات', wo: 'Jaay bu jiitu', bm: 'Jaara kɔrɔw', ff: 'Mbelgaaji keddiiɗi', sw: 'Historia ya mauzo', pt: 'Histórico de vendas' },
  stock_inventaire:    { fr: 'Inventaire / Stock', en: 'Inventory / Stock', ar: 'المخزون', wo: 'Njëkk weur', bm: 'Joli cogoya', ff: 'Ndeewoore', sw: 'Hesabu ya bidhaa', pt: 'Inventário / Estoque' },
  depots_garde:        { fr: 'Dépôts garde', en: 'Safe deposits', ar: 'الودائع', wo: 'Santaane yu sëkk', bm: 'Dɔnni', ff: 'Ndemmugol', sw: 'Amana', pt: 'Depósitos' },
  benefices_titre:     { fr: 'Bénéfices', en: 'Benefits', ar: 'الأرباح', wo: 'Jëm ak njëm', bm: 'Nafa', ff: 'Nafaaji', sw: 'Faida', pt: 'Lucros' },
  resultat_net:        { fr: 'Résultat net', en: 'Net result', ar: 'النتيجة الصافية', wo: 'Nattu bu dëkk', bm: 'Nafa dɔgɔtɔ', ff: 'Jaɓɓorgol ceerngal', sw: 'Matokeo halisi', pt: 'Resultado líquido' },
  mobile_money:        { fr: 'Mobile Money', en: 'Mobile Money', ar: 'موبايل موني', wo: 'Xaalis telefon', bm: 'Wari telefɔni', ff: 'Xaalis telefon', sw: 'Pesa ya simu', pt: 'Mobile Money' },
  bonus_fournisseurs:  { fr: 'Bonus fournisseurs', en: 'Supplier bonus', ar: 'مكافآت الموردين', wo: 'Bonus joxkat', bm: 'Jawulɔ nafa', ff: 'Yoɓooɓe bonus', sw: 'Bonasi ya wasambazaji', pt: 'Bônus fornecedores' },
  modele_facture:      { fr: 'Modèle de facture', en: 'Invoice template', ar: 'نموذج الفاتورة', wo: 'Model facture', bm: 'Facture model', ff: 'Model facture', sw: 'Kiolezo cha ankara', pt: 'Modelo de fatura' },
  config_transferts:   { fr: 'Config. transferts', en: 'Transfer config', ar: 'إعدادات التحويل', wo: 'Config yëbël', bm: 'Config yiriɛ', ff: 'Config nafooje', sw: 'Usanidi wa uhamishaji', pt: 'Config. transferências' },
  aide_ressources:     { fr: 'Aide & Ressources', en: 'Help & Resources', ar: 'المساعدة والموارد', wo: 'Ndimbal ak Ressources', bm: 'Dɛmɛ ni Ressources', ff: 'Ballal e Yiyde', sw: 'Msaada na Rasilimali', pt: 'Ajuda e Recursos' },
  parametres_boutique: { fr: 'Paramètres boutique', en: 'Shop settings', ar: 'إعدادات المتجر', wo: 'Reggal boutique', bm: 'Sɔrɔni boutique', ff: 'Parametre boutique', sw: 'Mipangilio ya duka', pt: 'Configurações da boutique' },
  mon_profil:          { fr: 'Mon profil', en: 'My profile', ar: 'ملفي الشخصي', wo: 'Sa profil', bm: 'N profil', ff: 'Profil am', sw: 'Wasifu wangu', pt: 'Meu perfil' },
  deconnexion_confirm: { fr: 'Voulez-vous vous déconnecter ?', en: 'Do you want to log out?', ar: 'هل تريد تسجيل الخروج؟', wo: 'Dafa soxor a génn?', bm: 'I bɛ bɔ wa?', ff: 'Mbiy yaltude?', sw: 'Unataka kuondoka?', pt: 'Quer sair?' },
  annuler:             { fr: 'Annuler', en: 'Cancel', ar: 'إلغاء', wo: 'Soppiku', bm: 'Bɔ', ff: 'Haɗ', sw: 'Ghairi', pt: 'Cancelar' },
  oui:                 { fr: 'Oui', en: 'Yes', ar: 'نعم', wo: 'Waaw', bm: 'Ɔwɔ', ff: 'Eey', sw: 'Ndiyo', pt: 'Sim' },

  // ── Produits ───────────────────────────────────────────────────────────────
  recherche_produit:   { fr: 'Rechercher un produit...', en: 'Search product...', ar: 'ابحث عن منتج...', wo: 'Seet benn-benn...', bm: 'Joli ɲini...', ff: 'Yiylo dewe...', sw: 'Tafuta bidhaa...', pt: 'Procurar produto...' },
  ajouter:             { fr: 'Ajouter', en: 'Add', ar: 'إضافة', wo: 'Yokk', bm: 'Fara', ff: 'Ɗaɓɓirde', sw: 'Ongeza', pt: 'Adicionar' },
  modifier:            { fr: 'Modifier', en: 'Edit', ar: 'تعديل', wo: 'Seet', bm: 'Yɛlɛma', ff: 'Waylude', sw: 'Hariri', pt: 'Editar' },
  supprimer:           { fr: 'Supprimer', en: 'Delete', ar: 'حذف', wo: 'Dëkk', bm: 'Bɔ', ff: 'Feccinde', sw: 'Futa', pt: 'Excluir' },
  enregistrer:         { fr: 'Enregistrer', en: 'Save', ar: 'حفظ', wo: 'Sos', bm: 'Mara', ff: 'Soodude', sw: 'Hifadhi', pt: 'Salvar' },
  nouveau_produit:     { fr: 'Nouveau produit', en: 'New product', ar: 'منتج جديد', wo: 'Benn-benn bu bees', bm: 'Joli kura', ff: 'Dewe keso', sw: 'Bidhaa mpya', pt: 'Novo produto' },
  nom_produit:         { fr: 'Nom du produit *', en: 'Product name *', ar: 'اسم المنتج *', wo: 'Turu benn-benn *', bm: 'Joli tɔgɔ *', ff: 'Innde dewe *', sw: 'Jina la bidhaa *', pt: 'Nome do produto *' },
  prix_achat:          { fr: "Prix d'achat", en: 'Purchase price', ar: 'سعر الشراء', wo: 'Prix jënd', bm: 'Jɔlilafɛ', ff: 'Njuɓɓudi soodude', sw: 'Bei ya ununuzi', pt: 'Preço de compra' },
  prix_vente:          { fr: 'Prix de vente', en: 'Selling price', ar: 'سعر البيع', wo: 'Prix jaay', bm: 'Jaara fɛ', ff: 'Njuɓɓudi mbelgaaji', sw: 'Bei ya kuuza', pt: 'Preço de venda' },
  stock:               { fr: 'Stock', en: 'Stock', ar: 'المخزون', wo: 'Njëkk weur', bm: 'Joli cogoya', ff: 'Ndeewoore', sw: 'Hisa', pt: 'Estoque' },
  seuil_alerte:        { fr: "Seuil d'alerte", en: 'Alert threshold', ar: 'حد التنبيه', wo: 'Seuil alerte', bm: 'Dɛmɛ seuil', ff: 'Seuil tiiɗo', sw: 'Kiwango cha onyo', pt: 'Nível de alerta' },
  categorie:           { fr: 'Catégorie', en: 'Category', ar: 'الفئة', wo: 'Catégorie', bm: 'Categorie', ff: 'Categorie', sw: 'Kategoria', pt: 'Categoria' },
  code_barres:         { fr: 'Code-barres', en: 'Barcode', ar: 'الباركود', wo: 'Code-barres', bm: 'Code-barres', ff: 'Code-barres', sw: 'Nambari ya bidhaa', pt: 'Código de barras' },
  hors_ligne:          { fr: 'Hors ligne', en: 'Offline', ar: 'غير متصل', wo: 'Hors ligne', bm: 'Offline', ff: 'Offline', sw: 'Nje ya mtandao', pt: 'Sem conexão' },
  en_attente_sync:     { fr: 'modification(s) en attente de sync', en: 'modification(s) pending sync', ar: 'تعديلات في انتظار المزامنة', wo: 'ak sync yi dëkk', bm: 'ni sync yɔrɔ la', ff: 'e sync ngoni', sw: 'zinasubiri ulandanishaji', pt: 'modificação(ões) aguardando sync' },

  // ── Vente ──────────────────────────────────────────────────────────────────
  panier:              { fr: 'Panier', en: 'Cart', ar: 'السلة', wo: 'Panier', bm: 'Panier', ff: 'Panier', sw: 'Kikapu', pt: 'Carrinho' },
  encaisser:           { fr: 'Encaisser', en: 'Checkout', ar: 'الدفع', wo: 'Jël xaalis', bm: 'Sɔrɔ wari', ff: 'Jaɓɓirde', sw: 'Lipa', pt: 'Cobrar' },
  vider:               { fr: 'Vider', en: 'Clear', ar: 'إفراغ', wo: 'Dopp', bm: 'Bɔ bɛɛ', ff: 'Haɗ fof', sw: 'Ondoa yote', pt: 'Limpar' },
  encaissement:        { fr: 'Encaissement', en: 'Payment', ar: 'الدفع', wo: 'Jël xaalis', bm: 'Sɔrɔ wari', ff: 'Jaɓɓorgol', sw: 'Malipo', pt: 'Pagamento' },
  total:               { fr: 'Total', en: 'Total', ar: 'المجموع', wo: 'Total', bm: 'Total', ff: 'Total', sw: 'Jumla', pt: 'Total' },
  mode_paiement:       { fr: 'Mode de paiement', en: 'Payment method', ar: 'طريقة الدفع', wo: 'Dara pey', bm: 'Fali jɔli', ff: 'Mode paiement', sw: 'Njia ya malipo', pt: 'Modo de pagamento' },
  montant_recu:        { fr: 'Montant reçu', en: 'Amount received', ar: 'المبلغ المستلم', wo: 'Xaalis yu jël', bm: 'Wari sɔrɔlen', ff: 'Njuɓɓudi jaɓɓannde', sw: 'Kiasi kilichopokelewa', pt: 'Valor recebido' },
  monnaie:             { fr: 'Monnaie', en: 'Change', ar: 'الباقي', wo: 'Monnaie', bm: 'Wari dɔgɔ', ff: 'Ngalu', sw: 'Chenji', pt: 'Troco' },
  confirmer_vente:     { fr: 'Confirmer la vente', en: 'Confirm sale', ar: 'تأكيد البيع', wo: 'Dëkk jaay bi', bm: 'Jaara dafali', ff: 'Mbelgaaji seerndude', sw: 'Thibitisha mauzo', pt: 'Confirmar venda' },
  est_credit:          { fr: 'Vente à crédit', en: 'Credit sale', ar: 'بيع بالآجل', wo: 'Jaay ak yar', bm: 'Jaara nanu', ff: 'Mbelgaaji ɓolɗe', sw: 'Mauzo ya mkopo', pt: 'Venda a crédito' },
  rupture_stock:       { fr: 'Rupture de stock', en: 'Out of stock', ar: 'نفد المخزون', wo: 'Njëkk weur bees', bm: 'Joli dafali kɔ', ff: 'Ndeewoore wayni', sw: 'Bidhaa imekwisha', pt: 'Sem estoque' },
  stock_insuffisant:   { fr: 'Stock insuffisant', en: 'Insufficient stock', ar: 'مخزون غير كافٍ', wo: 'Njëkk weur dafa famm', bm: 'Joli dɔgɔ', ff: 'Ndeewoore baaɗaani', sw: 'Hisa haitoshi', pt: 'Estoque insuficiente' },
  succes:              { fr: 'Succès', en: 'Success', ar: 'نجاح', wo: 'Defar ak dëkk', bm: 'Kɛra ka ɲɛ', ff: 'Moƴƴi', sw: 'Mafanikio', pt: 'Sucesso' },
  vente_enregistree:   { fr: 'Vente enregistrée avec succès !', en: 'Sale recorded successfully!', ar: 'تم تسجيل البيع بنجاح!', wo: 'Jaay bi sos na!', bm: 'Jaara kɛra ka ɲɛ!', ff: 'Mbelgaaji maran!', sw: 'Mauzo yamehifadhiwa!', pt: 'Venda registrada com sucesso!' },
  vente_hors_ligne:    { fr: 'Vente enregistrée hors ligne — sera synchronisée quand internet revient', en: 'Sale saved offline — will sync when internet returns', ar: 'تم حفظ البيع دون اتصال', wo: 'Jaay sos ci offline', bm: 'Jaara mara offline', ff: 'Mbelgaaji maran offline', sw: 'Mauzo yamehifadhiwa bila mtandao', pt: 'Venda salva offline' },

  // ── Navigation tabs ──────────────────────────────────────────────────────────
  tab_produits:  { fr: 'Produits', en: 'Products', ar: 'المنتجات', wo: 'Benn-benn', bm: 'Joli', ff: 'Dewe', sw: 'Bidhaa', pt: 'Produtos' },
  tab_vente:     { fr: 'Vente', en: 'Sales', ar: 'مبيعات', wo: 'Jaay', bm: 'Jaara', ff: 'Mbelgaaji', sw: 'Mauzo', pt: 'Vendas' },
  tab_caisse:    { fr: 'Caisse', en: 'Cash', ar: 'الصندوق', wo: 'Caisse', bm: 'Wari', ff: 'Sariyaaji', sw: 'Fedha', pt: 'Caixa' },
  tab_rapports:  { fr: 'Rapports', en: 'Reports', ar: 'التقارير', wo: 'Wax-waxu', bm: 'Kunnafoniko', ff: 'Limooje', sw: 'Ripoti', pt: 'Relatórios' },
  tab_menu:      { fr: 'Menu', en: 'Menu', ar: 'القائمة', wo: 'Listu', bm: 'Listu', ff: 'Listu', sw: 'Menyu', pt: 'Menu' },

  // ── Actions générales ─────────────────────────────────────────────────────────
  imprimer:      { fr: 'Imprimer', en: 'Print', ar: 'طباعة', wo: 'Daf', bm: 'Sɛbɛn', ff: 'Winndude', sw: 'Chapisha', pt: 'Imprimir' },
  partager:      { fr: 'Partager', en: 'Share', ar: 'مشاركة', wo: 'Yónn', bm: 'Ladɔnnin', ff: 'Heblude', sw: 'Shiriki', pt: 'Partilhar' },

  // ── Factures ─────────────────────────────────────────────────────────────────
  voir_facture:  { fr: 'Voir facture', en: 'View invoice', ar: 'عرض الفاتورة', wo: 'Xool facture', bm: 'Facture jeli', ff: 'Janngo facture', sw: 'Ona ankara', pt: 'Ver fatura' },
  telecharger:   { fr: 'Télécharger', en: 'Download', ar: 'تحميل', wo: 'Jël', bm: 'Sɔrɔ', ff: 'Jaɓɓirde', sw: 'Pakua', pt: 'Baixar' },
  aucune_facture: { fr: 'Aucune facture', en: 'No invoice', ar: 'لا توجد فواتير', wo: 'Amul facture', bm: 'Facture ma sɔrɔ', ff: 'Alaa facture', sw: 'Hakuna ankara', pt: 'Nenhuma fatura' },

  // ── Notifications ─────────────────────────────────────────────────────────────
  aucune_notif:  { fr: 'Aucune notification', en: 'No notifications', ar: 'لا توجد إشعارات', wo: 'Amul notification', bm: 'Notification ma sɔrɔ', ff: 'Alaa notifications', sw: 'Hakuna arifa', pt: 'Nenhuma notificação' },
  tout_lire:     { fr: 'Tout marquer comme lu', en: 'Mark all as read', ar: 'تعليم الكل كمقروء', wo: 'Dëkk yépp jël', bm: 'Yépp kalan', ff: 'Hoyti fof', sw: 'Weka zote kama zilizosomwa', pt: 'Marcar tudo como lido' },

  // ── Profil ────────────────────────────────────────────────────────────────────
  mon_profil_titre: { fr: 'Mon profil', en: 'My profile', ar: 'ملفي الشخصي', wo: 'Sa profil', bm: 'N profil', ff: 'Profil am', sw: 'Wasifu wangu', pt: 'Meu perfil' },
  nom_complet:   { fr: 'Nom complet', en: 'Full name', ar: 'الاسم الكامل', wo: 'Turu bu dëkk', bm: 'Tɔgɔ bɛɛ', ff: 'Innde fof', sw: 'Jina kamili', pt: 'Nome completo' },
  role:          { fr: 'Rôle', en: 'Role', ar: 'الدور', wo: 'Rôle', bm: 'Baara', ff: 'Teɓɓere', sw: 'Jukumu', pt: 'Função' },
  changer_photo: { fr: 'Changer la photo', en: 'Change photo', ar: 'تغيير الصورة', wo: 'Yëbël liggéey', bm: 'Fɔtɔ yɛlɛma', ff: 'Waylude ɓiɓɓe', sw: 'Badilisha picha', pt: 'Alterar foto' },

  // ── Boutique settings ─────────────────────────────────────────────────────────
  infos_boutique: { fr: 'Informations boutique', en: 'Shop information', ar: 'معلومات المتجر', wo: 'Xam-xam boutique', bm: 'Boutique kunnafoni', ff: 'Humpito boutique', sw: 'Maelezo ya duka', pt: 'Informações da boutique' },
  nom_boutique:  { fr: 'Nom de la boutique', en: 'Shop name', ar: 'اسم المتجر', wo: 'Turu boutique bi', bm: 'Boutique tɔgɔ', ff: 'Innde boutique', sw: 'Jina la duka', pt: 'Nome da boutique' },
  ville:         { fr: 'Ville', en: 'City', ar: 'المدينة', wo: 'Dëkk', bm: 'Dugu', ff: 'Wuro', sw: 'Mji', pt: 'Cidade' },
  pays:          { fr: 'Pays', en: 'Country', ar: 'البلد', wo: 'Réew', bm: 'Mara', ff: 'Leydi', sw: 'Nchi', pt: 'País' },
  devise:        { fr: 'Devise', en: 'Currency', ar: 'العملة', wo: 'Xaalis', bm: 'Wari', ff: 'Kaalisi', sw: 'Sarafu', pt: 'Moeda' },
  sauvegarder:   { fr: 'Sauvegarder', en: 'Save', ar: 'حفظ', wo: 'Sos', bm: 'Mara', ff: 'Soodude', sw: 'Hifadhi', pt: 'Guardar' },

  // ── Transferts ────────────────────────────────────────────────────────────────
  nouveau_transfert: { fr: 'Nouveau transfert', en: 'New transfer', ar: 'تحويل جديد', wo: 'Yëbël bu bees', bm: 'Yiriɛ kura', ff: 'Nafoore keso', sw: 'Uhamishaji mpya', pt: 'Nova transferência' },
  boutique_source: { fr: 'Boutique source', en: 'Source shop', ar: 'المتجر المصدر', wo: 'Boutique bu jiitu', bm: 'Boutique sɔrɔ', ff: 'Boutique taworde', sw: 'Duka chanzo', pt: 'Boutique de origem' },
  boutique_dest: { fr: 'Boutique destination', en: 'Destination shop', ar: 'المتجر الوجهة', wo: 'Boutique bu des', bm: 'Boutique tɔgɔ kɔni', ff: 'Boutique naatorde', sw: 'Duka la marudio', pt: 'Boutique de destino' },

  // ── Bénéfices / Résultat ──────────────────────────────────────────────────────
  benefice_brut: { fr: 'Bénéfice brut', en: 'Gross profit', ar: 'الربح الإجمالي', wo: 'Nafa bu jëm', bm: 'Nafa bɛɛ', ff: 'Nafaaji', sw: 'Faida ghafi', pt: 'Lucro bruto' },
  benefice_net:  { fr: 'Bénéfice net', en: 'Net profit', ar: 'الربح الصافي', wo: 'Nafa bu dëkk', bm: 'Nafa dɔgɔtɔ', ff: 'Nafaaji bure', sw: 'Faida halisi', pt: 'Lucro líquido' },
  charges:       { fr: 'Charges', en: 'Charges', ar: 'التكاليف', wo: 'Yóbbu', bm: 'Fali', ff: 'Ɓatuɗe', sw: 'Gharama', pt: 'Encargos' },

  // ── Mobile Money ──────────────────────────────────────────────────────────────
  envoi_argent:  { fr: "Envoi d'argent", en: 'Send money', ar: 'إرسال المال', wo: 'Yónn xaalis', bm: 'Wari ci', ff: 'Jawde wari', sw: 'Tuma pesa', pt: 'Enviar dinheiro' },
  numero:        { fr: 'Numéro', en: 'Number', ar: 'الرقم', wo: 'Numero', bm: 'Numero', ff: 'Ɗemngal', sw: 'Nambari', pt: 'Número' },

  // ── Bonus fournisseurs ────────────────────────────────────────────────────────
  nouveau_bonus: { fr: 'Nouveau bonus', en: 'New bonus', ar: 'مكافأة جديدة', wo: 'Bonus bu bees', bm: 'Bonus kura', ff: 'Bonus keso', sw: 'Bonasi mpya', pt: 'Novo bônus' },
  fournisseur:   { fr: 'Fournisseur', en: 'Supplier', ar: 'المورد', wo: 'Joxkat', bm: 'Jawulɔ', ff: 'Yoɓɓoowo', sw: 'Msambazaji', pt: 'Fornecedor' },

  // ── Facture design ────────────────────────────────────────────────────────────
  classique:     { fr: 'Classique', en: 'Classic', ar: 'كلاسيكي', wo: 'Classique', bm: 'Kɔrɔ', ff: 'Klassik', sw: 'Kawaida', pt: 'Clássico' },
  moderne:       { fr: 'Moderne', en: 'Modern', ar: 'عصري', wo: 'Bu jooju', bm: 'Kura', ff: 'Modern', sw: 'Ya kisasa', pt: 'Moderno' },
  minimaliste:   { fr: 'Minimaliste', en: 'Minimalist', ar: 'بسيط', wo: 'Seddeel', bm: 'Dɔgɔ', ff: 'Doltiiɗo', sw: 'Rahisi', pt: 'Minimalista' },
  apercu:        { fr: 'Aperçu', en: 'Preview', ar: 'معاينة', wo: 'Jël ak xool', bm: 'Jeli', ff: 'Yiilaade', sw: 'Onyesho la awali', pt: 'Pré-visualisation' },

  // ── Assistant IA ──────────────────────────────────────────────────────────────
  assistant_ia:  { fr: 'Assistant IA', en: 'AI Assistant', ar: 'المساعد الذكي', wo: 'Ndimbal IA', bm: 'IA dɛmɛkɛla', ff: 'Ballal IA', sw: 'Msaidizi wa AI', pt: 'Assistente IA' },
  ecrire_message: { fr: 'Écrire un message...', en: 'Write a message...', ar: 'اكتب رسالة...', wo: 'Sëbëlu xbaar...', bm: 'Sëbɛn kɔrɔ...', ff: 'Winndude haala...', sw: 'Andika ujumbe...', pt: 'Escrever uma mensagem...' },
  envoyer:       { fr: 'Envoyer', en: 'Send', ar: 'إرسال', wo: 'Yónn', bm: 'Ci', ff: 'Jaɓɓir', sw: 'Tuma', pt: 'Enviar' },

  // ── Ressources ────────────────────────────────────────────────────────────────
  aide:          { fr: 'Aide', en: 'Help', ar: 'المساعدة', wo: 'Ndimbal', bm: 'Dɛmɛ', ff: 'Ballal', sw: 'Msaada', pt: 'Ajuda' },
  contact_support: { fr: 'Contacter le support', en: 'Contact support', ar: 'تواصل مع الدعم', wo: 'Jox support bi', bm: 'Support ci', ff: 'Naatdir support', sw: 'Wasiliana na usaidizi', pt: 'Contactar suporte' },

  // ── Commandes statuts ────────────────────────────────────────────────────────
  validee:           { fr: 'Validée', en: 'Validated', ar: 'مؤكدة', wo: 'Dëkk na', bm: 'Dafalen', ff: 'Jaɓɓaama', sw: 'Imethibitishwa', pt: 'Validado' },
  annulee:           { fr: 'Annulée', en: 'Cancelled', ar: 'ملغاة', wo: 'Soppiku na', bm: 'Bɔlen', ff: 'Haɗaama', sw: 'Imeghairiwa', pt: 'Cancelado' },
  brouillon:         { fr: 'Brouillon', en: 'Draft', ar: 'مسودة', wo: 'Brouillon', bm: 'Fɔɲɔ', ff: 'Kaɓɓugal', sw: 'Rasimu', pt: 'Rascunho' },
  nouvelle_commande: { fr: 'Nouvelle commande', en: 'New order', ar: 'طلب جديد', wo: 'Commande bu bees', bm: 'Baara kura', ff: 'Jaaɓirde keso', sw: 'Agizo jipya', pt: 'Novo pedido' },
  recherche_commande:{ fr: 'Rechercher commande, client...', en: 'Search order, client...', ar: 'ابحث عن طلب، عميل...', wo: 'Seet commande, jëkël...', bm: 'Baara, ciden ɲini...', ff: 'Yiylo jaaɓirde, kiliyel...', sw: 'Tafuta agizo, mteja...', pt: 'Procurar pedido, cliente...' },
  valider:           { fr: 'Valider', en: 'Validate', ar: 'تأكيد', wo: 'Dëkk', bm: 'Dafali', ff: 'Jaɓɓir', sw: 'Thibitisha', pt: 'Validar' },
  regler:            { fr: 'Régler', en: 'Settle', ar: 'تسوية', wo: 'Dëkk', bm: 'Fali', ff: 'Jaɓɓir', sw: 'Lipa', pt: 'Liquidar' },
  reglement_groupe:  { fr: 'Règlement groupé crédits', en: 'Grouped credit settlement', ar: 'تسوية جماعية للائتمان', wo: 'Dëkk nanu yi', bm: 'Nanu fali wɛrɛw', ff: 'Ɓolɗe faleede', sw: 'Malipo ya mkopo ya pamoja', pt: 'Liquidação agrupada de créditos' },
  reglement_credit:  { fr: 'Régler le crédit', en: 'Settle credit', ar: 'تسوية الائتمان', wo: 'Dëkk nanu bi', bm: 'Nanu fali', ff: 'Ɓolɗe jaɓɓir', sw: 'Lipa mkopo', pt: 'Liquidar crédito' },
  tout_selectionner: { fr: 'Tout sélectionner', en: 'Select all', ar: 'تحديد الكل', wo: 'Tanu yépp', bm: 'Yépp sugandi', ff: 'Suɓ fof', sw: 'Chagua zote', pt: 'Selecionar tudo' },
  paiement_credit:   { fr: 'Paiement à crédit', en: 'Credit payment', ar: 'دفع بالآجل', wo: 'Pey ak yar', bm: 'Fali nanu', ff: 'Jaɓɓorgol ɓolɗe', sw: 'Malipo ya mkopo', pt: 'Pagamento a crédito' },
  montant_verse:     { fr: 'Montant versé maintenant', en: 'Amount paid now', ar: 'المبلغ المدفوع الآن', wo: 'Xaalis bu pey ci kanam', bm: 'Wari fali sisan', ff: 'Wari jaɓɓetenooɗo hannde', sw: 'Kiasi kilicholipwa sasa', pt: 'Valor pago agora' },
  date_echeance:     { fr: 'Date échéance (YYYY-MM-DD)', en: 'Due date (YYYY-MM-DD)', ar: 'تاريخ الاستحقاق (YYYY-MM-DD)', wo: 'Date xàt (YYYY-MM-DD)', bm: 'Laban date (YYYY-MM-DD)', ff: 'Date haaɗtaare (YYYY-MM-DD)', sw: 'Tarehe ya malipo (YYYY-MM-DD)', pt: 'Data de vencimento (YYYY-MM-DD)' },
  reste_du:          { fr: 'Reste dû', en: 'Amount due', ar: 'المتبقي المستحق', wo: 'Bu tollu', bm: 'Tɔɔ', ff: 'Haɗɗe', sw: 'Kilichobaki', pt: 'Restante devido' },
  verse:             { fr: 'Versé', en: 'Paid', ar: 'مدفوع', wo: 'Pay na', bm: 'Falen', ff: 'Jaɓɓaama', sw: 'Imelipwa', pt: 'Pago' },
  reste:             { fr: 'Reste', en: 'Rest', ar: 'المتبقي', wo: 'Tollu', bm: 'Tɔɔ', ff: 'Haɗɗo', sw: 'Kilichobaki', pt: 'Resto' },
  aucune_commande:   { fr: 'Aucune commande', en: 'No order', ar: 'لا توجد طلبات', wo: 'Amul commande', bm: 'Baara ma sɔrɔ', ff: 'Alaa jaaɓirɗe', sw: 'Hakuna agizo', pt: 'Nenhum pedido' },
  ca_valide:         { fr: 'CA validé', en: 'Validated revenue', ar: 'رقم الأعمال المؤكد', wo: 'CA dëkk na', bm: 'Jaara dafalen', ff: 'CA jaɓɓaaɗo', sw: 'Mapato yaliyothibitishwa', pt: 'Faturamento validado' },
  moitie:            { fr: 'Moitié', en: 'Half', ar: 'نصف', wo: 'Dëkkante', bm: 'Filanan', ff: 'Badoore', sw: 'Nusu', pt: 'Metade' },
  tout_regler:       { fr: 'Tout régler', en: 'Settle all', ar: 'تسوية الكل', wo: 'Dëkk yépp', bm: 'Yépp fali', ff: 'Fof jaɓɓir', sw: 'Lipa yote', pt: 'Liquidar tudo' },
  notes:             { fr: 'Notes...', en: 'Notes...', ar: 'ملاحظات...', wo: 'Notes...', bm: 'Sëbɛn...', ff: 'Winndannde...', sw: 'Maelezo...', pt: 'Notas...' },
  nom:               { fr: 'Nom', en: 'Name', ar: 'الاسم', wo: 'Turu', bm: 'Tɔgɔ', ff: 'Innde', sw: 'Jina', pt: 'Nome' },
  prenom:            { fr: 'Prénom', en: 'First name', ar: 'الاسم الأول', wo: 'Tur gannaaw', bm: 'Tɔgɔ fɔlɔ', ff: 'Innde addi', sw: 'Jina la kwanza', pt: 'Primeiro nome' },
  ajouter_produit:   { fr: 'Ajouter au moins un produit', en: 'Add at least one product', ar: 'أضف منتجاً واحداً على الأقل', wo: 'Yokk ab benn-benn', bm: 'Joli kelen fara', ff: 'Ɗaɓɓir dewe gooto', sw: 'Ongeza bidhaa angalau moja', pt: 'Adicione pelo menos um produto' },

  // ── Historique ventes ────────────────────────────────────────────────────────
  historique:        { fr: 'Historique', en: 'History', ar: 'السجل', wo: 'Bu jiitu', bm: 'Kɔrɔw', ff: 'Keddiiɗi', sw: 'Historia', pt: 'Histórico' },
  recherche_vente:   { fr: 'Rechercher une vente...', en: 'Search sale...', ar: 'ابحث عن مبيعة...', wo: 'Seet jaay...', bm: 'Jaara ɲini...', ff: 'Yiylo mbelgaaji...', sw: 'Tafuta mauzo...', pt: 'Procurar venda...' },
  annuler_vente:     { fr: 'Annuler la vente', en: 'Cancel sale', ar: 'إلغاء البيع', wo: 'Soppiku jaay bi', bm: 'Jaara bɔ', ff: 'Haɗ mbelgaaji', sw: 'Ghairi mauzo', pt: 'Cancelar venda' },
  vente_annulee:     { fr: 'Vente annulée', en: 'Sale cancelled', ar: 'تم إلغاء البيع', wo: 'Jaay bi soppiku na', bm: 'Jaara bɔlen', ff: 'Mbelgaaji haɗaama', sw: 'Mauzo yameghairiwa', pt: 'Venda cancelada' },
  periode:           { fr: 'Période', en: 'Period', ar: 'الفترة', wo: 'Période', bm: 'Waati', ff: 'Sahaa', sw: 'Kipindi', pt: 'Período' },
  debut:             { fr: 'Début', en: 'Start', ar: 'البداية', wo: 'Jël jàkk', bm: 'Daminɛ', ff: 'Fuɗɗorde', sw: 'Mwanzo', pt: 'Início' },
  fin:               { fr: 'Fin', en: 'End', ar: 'النهاية', wo: 'Xàt', bm: 'Laban', ff: 'Haaɗtaare', sw: 'Mwisho', pt: 'Fim' },
  filtrer:           { fr: 'Filtrer', en: 'Filter', ar: 'تصفية', wo: 'Filtrer', bm: 'Siɲɛ', ff: 'Siifindirde', sw: 'Chuja', pt: 'Filtrar' },
  exporter:          { fr: 'Exporter PDF', en: 'Export PDF', ar: 'تصدير PDF', wo: 'Export PDF', bm: 'PDF bɔ', ff: 'PDF yaltinde', sw: 'Hamisha PDF', pt: 'Exportar PDF' },
  aucune_vente:      { fr: 'Aucune vente trouvée', en: 'No sales found', ar: 'لا توجد مبيعات', wo: 'Amul jaay', bm: 'Jaara ma sɔrɔ', ff: 'Alaa mbelgaaji', sw: 'Hakuna mauzo', pt: 'Nenhuma venda encontrada' },
  credit_restant:    { fr: 'Crédit restant', en: 'Remaining credit', ar: 'الائتمان المتبقي', wo: 'Nanu tollu', bm: 'Nanu tɔɔ', ff: 'Ɓolɗe haɗɗo', sw: 'Mkopo uliobaki', pt: 'Crédito restante' },
  client_anonyme:    { fr: 'Client anonyme', en: 'Anonymous client', ar: 'عميل مجهول', wo: 'Jëkël bu amul turu', bm: 'Ciden tɔgɔ dɔn', ff: 'Kiliyel innde alaa', sw: 'Mteja asiyejulikana', pt: 'Cliente anónimo' },
  detail_vente:      { fr: 'Détail vente', en: 'Sale detail', ar: 'تفاصيل البيع', wo: 'Xam-xam jaay bi', bm: 'Jaara kunnafoni', ff: 'Siifannde mbelgaaji', sw: 'Maelezo ya mauzo', pt: 'Detalhe da venda' },
  informations:      { fr: 'Informations', en: 'Information', ar: 'المعلومات', wo: 'Xam-xam', bm: 'Kunnafoni', ff: 'Humpito', sw: 'Maelezo', pt: 'Informações' },
  paiement:          { fr: 'Paiement', en: 'Payment', ar: 'الدفع', wo: 'Pey', bm: 'Fali', ff: 'Jaɓɓorgol', sw: 'Malipo', pt: 'Pagamento' },
  mode:              { fr: 'Mode', en: 'Mode', ar: 'الطريقة', wo: 'Xam-xam', bm: 'Joli', ff: 'Nde', sw: 'Njia', pt: 'Modo' },

  // ── Inventaire ────────────────────────────────────────────────────────────────
  ajuster_stock:     { fr: 'Ajuster le stock', en: 'Adjust stock', ar: 'تعديل المخزون', wo: 'Wér njëkk weur', bm: 'Joli yɛlɛma', ff: 'Seerndirde ndeewoore', sw: 'Rekebisha hisa', pt: 'Ajustar estoque' },
  nouveau_stock:     { fr: 'Nouveau stock', en: 'New stock', ar: 'مخزون جديد', wo: 'Njëkk weur bees', bm: 'Joli kura', ff: 'Ndeewoore keso', sw: 'Hisa mpya', pt: 'Novo estoque' },
  en_rupture:        { fr: 'En rupture', en: 'Out of stock', ar: 'نفد', wo: 'Bees na', bm: 'Bɔlen', ff: 'Wayni', sw: 'Imekwisha', pt: 'Esgotado' },
  stock_faible:      { fr: 'Stock faible', en: 'Low stock', ar: 'مخزون منخفض', wo: 'Njëkk weur dafa famm', bm: 'Joli dɔgɔ', ff: 'Ndeewoore famɗi', sw: 'Hisa ndogo', pt: 'Estoque baixo' },
  mouvements:        { fr: 'Mouvements', en: 'Movements', ar: 'الحركات', wo: 'Yëbëlal', bm: 'Yiriw', ff: 'Yiylaade', sw: 'Mwendo', pt: 'Movimentos' },
  entree_stock:      { fr: 'Entrée stock', en: 'Stock in', ar: 'دخول مخزون', wo: 'Dëkk njëkk weur', bm: 'Joli naani', ff: 'Ndeewoore naatde', sw: 'Bidhaa zinazoingia', pt: 'Entrada estoque' },
  sortie_stock:      { fr: 'Sortie stock', en: 'Stock out', ar: 'خروج مخزون', wo: 'Génn njëkk weur', bm: 'Joli bɔra', ff: 'Ndeewoore yaltude', sw: 'Bidhaa zinazotoka', pt: 'Saída estoque' },
  raison:            { fr: 'Raison', en: 'Reason', ar: 'السبب', wo: 'Raison', bm: 'Dalili', ff: 'Saabe', sw: 'Sababu', pt: 'Razão' },
  quantite:          { fr: 'Quantité', en: 'Quantity', ar: 'الكمية', wo: 'Yënn', bm: 'Hakɛ', ff: 'Keeriindi', sw: 'Kiasi', pt: 'Quantidade' },
  nouveau_mouvement: { fr: 'Nouveau mouvement', en: 'New movement', ar: 'حركة جديدة', wo: 'Yëbëlal bu bees', bm: 'Yiriw kura', ff: 'Yiylaade keso', sw: 'Mwendo mpya', pt: 'Novo movimento' },
  valeur_stock:      { fr: 'Valeur stock', en: 'Stock value', ar: 'قيمة المخزون', wo: 'Njëkk weur njëg', bm: 'Joli nafa', ff: 'Ndeewoore njuɓɓudi', sw: 'Thamani ya hisa', pt: 'Valor do estoque' },
  type_mouvement:    { fr: 'Type de mouvement *', en: 'Movement type *', ar: 'نوع الحركة *', wo: 'Xam-xam yëbëlal *', bm: 'Yiriw jɔli *', ff: 'Lenyol yiylaade *', sw: 'Aina ya mwendo *', pt: 'Tipo de movimento *' },
  aucun_mouvement:   { fr: 'Aucun mouvement', en: 'No movement', ar: 'لا توجد حركات', wo: 'Amul yëbëlal', bm: 'Yiriw ma sɔrɔ', ff: 'Alaa yiylaade', sw: 'Hakuna mwendo', pt: 'Nenhum movimento' },
  selectionner_produit: { fr: 'Sélectionner un produit *', en: 'Select a product *', ar: 'اختر منتجاً *', wo: 'Tanu benn-benn *', bm: 'Joli sugandi *', ff: 'Suɓ dewe *', sw: 'Chagua bidhaa *', pt: 'Selecionar produto *' },
  niveaux:           { fr: 'Niveaux', en: 'Levels', ar: 'المستويات', wo: 'Niveaux', bm: 'Ɲɛsin', ff: 'Daraje', sw: 'Viwango', pt: 'Níveis' },
  ruptures:          { fr: 'Ruptures', en: 'Out of stock', ar: 'نفاد المخزون', wo: 'Ruptures', bm: 'Joli bɔlen', ff: 'Waɗaaɗe', sw: 'Bidhaa zilizokwisha', pt: 'Rupturas' },
  stock_bas:         { fr: 'Stock bas', en: 'Low stock', ar: 'مخزون منخفض', wo: 'Stock famm', bm: 'Joli dɔgɔ', ff: 'Ndeewoore famɗi', sw: 'Hisa ndogo', pt: 'Estoque baixo' },

  // ── Dépôts garde ─────────────────────────────────────────────────────────────
  nouveau_depot:     { fr: 'Nouveau dépôt', en: 'New deposit', ar: 'وديعة جديدة', wo: 'Santaane bu bees', bm: 'Dɔnni kura', ff: 'Ndemmugal keso', sw: 'Amana mpya', pt: 'Novo depósito' },
  retrait:           { fr: 'Retrait', en: 'Withdrawal', ar: 'سحب', wo: 'Jël', bm: 'Bɔ', ff: 'Yaltirde', sw: 'Kutoa', pt: 'Retirada' },
  cloturer:          { fr: 'Clôturer', en: 'Close', ar: 'إغلاق', wo: 'Dëkk', bm: 'Dafali', ff: 'Timminde', sw: 'Funga', pt: 'Encerrar' },
  montant_depot:     { fr: 'Montant déposé', en: 'Deposited amount', ar: 'المبلغ المودع', wo: 'Xaalis bu dëkk', bm: 'Dɔnni wari', ff: 'Wari mboɗɗitaaɗo', sw: 'Kiasi kilichowekwa', pt: 'Valor depositado' },
  montant_retrait:   { fr: 'Montant du retrait', en: 'Withdrawal amount', ar: 'مبلغ السحب', wo: 'Xaalis bu jël', bm: 'Bɔ wari', ff: 'Wari yaltirteeɗo', sw: 'Kiasi cha kutoa', pt: 'Valor da retirada' },
  actif:             { fr: 'Actif', en: 'Active', ar: 'نشط', wo: 'Aktif', bm: 'Di baara la', ff: 'Goongɗinaaɗo', sw: 'Amilifu', pt: 'Ativo' },
  cloture:           { fr: 'Clôturé', en: 'Closed', ar: 'مغلق', wo: 'Dëkk na', bm: 'Dafalen', ff: 'Timminaama', sw: 'Umefungwa', pt: 'Encerrado' },
  aucun_depot:       { fr: 'Aucun dépôt enregistré', en: 'No deposit recorded', ar: 'لا توجد ودائع', wo: 'Amul santaane', bm: 'Dɔnni ma sɔrɔ', ff: 'Alaa ndemmugal', sw: 'Hakuna amana', pt: 'Nenhum depósito registado' },
  nom_deposant:      { fr: 'Nom du déposant', en: 'Depositor name', ar: 'اسم المودِع', wo: 'Turu bu santaane bi', bm: 'Dɔnni mɔgɔ tɔgɔ', ff: 'Innde mboɗɗoowo', sw: 'Jina la mweka amana', pt: 'Nome do depositante' },
  personne_existante:{ fr: 'Sélectionner une personne existante', en: 'Select existing person', ar: 'اختر شخصاً موجوداً', wo: 'Tanu ab nit ku am', bm: 'Mɔgɔ sɔrɔlen sugandi', ff: 'Suɓ neɗɗo gonɗo', sw: 'Chagua mtu aliyepo', pt: 'Selecionar pessoa existente' },
  effectuer_retrait: { fr: 'Effectuer un retrait', en: 'Make a withdrawal', ar: 'إجراء سحب', wo: 'Def ab jël', bm: 'Bɔ dɛsɛ', ff: 'Yaltirde wari', sw: 'Fanya uondoaji', pt: 'Efectuar levantamento' },
  historique_retraits:{ fr: 'Historique des retraits', en: 'Withdrawal history', ar: 'سجل السحوبات', wo: 'Jiitu jël yi', bm: 'Bɔ kɔrɔw', ff: 'Keddiiɗi yaltirɗe', sw: 'Historia ya kutoa', pt: 'Histórico de levantamentos' },
  disponible:        { fr: 'Disponible', en: 'Available', ar: 'متاح', wo: 'Am na', bm: 'Sɔrɔlen', ff: 'Sikkitiima', sw: 'Inapatikana', pt: 'Disponível' },
  restant:           { fr: 'Restant', en: 'Remaining', ar: 'المتبقي', wo: 'Tollu', bm: 'Tɔɔ', ff: 'Haɗɗo', sw: 'Kilichobaki', pt: 'Restante' },
  initial:           { fr: 'Initial', en: 'Initial', ar: 'الأولي', wo: 'Bu tànn', bm: 'Daminɛ', ff: 'Kawtal', sw: 'Ya awali', pt: 'Inicial' },
  retire:            { fr: 'Retiré', en: 'Withdrawn', ar: 'مسحوب', wo: 'Jël na', bm: 'Bɔlen', ff: 'Yaltiraama', sw: 'Imeondolewa', pt: 'Retirado' },
  en_garde:          { fr: 'En garde', en: 'In custody', ar: 'في الحراسة', wo: 'Ci dikkeleen', bm: 'Di dogoni', ff: 'E keeri', sw: 'Kwa ulinzi', pt: 'Em custódia' },
  actifs:            { fr: 'Actifs', en: 'Active', ar: 'نشطة', wo: 'Aktifs', bm: 'Di baara la', ff: 'Goongɗinaaɗe', sw: 'Amilifu', pt: 'Ativos' },
  clotures:          { fr: 'Clôturés', en: 'Closed', ar: 'مغلقة', wo: 'Dëkk nañu', bm: 'Dafalenw', ff: 'Timminaama', sw: 'Imefungwa', pt: 'Encerrados' },

  // ── Promotions ────────────────────────────────────────────────────────────────
  nouvelle_promo:    { fr: 'Nouvelle promotion', en: 'New promotion', ar: 'عرض جديد', wo: 'Promotion bu bees', bm: 'Promotion kura', ff: 'Promotion keso', sw: 'Ofa mpya', pt: 'Nova promoção' },
  type_promo:        { fr: 'Type', en: 'Type', ar: 'النوع', wo: 'Xam-xam', bm: 'Joli', ff: 'Lenyol', sw: 'Aina', pt: 'Tipo' },
  remise:            { fr: 'Remise (%)', en: 'Discount (%)', ar: 'خصم (%)', wo: 'Remise (%)', bm: 'Dɔgɔ (%)', ff: 'Ceerngal (%)', sw: 'Punguzo (%)', pt: 'Desconto (%)' },
  active:            { fr: 'Active', en: 'Active', ar: 'نشطة', wo: 'Aktif', bm: 'Di baara la', ff: 'Goongɗinaaɗe', sw: 'Amilifu', pt: 'Ativa' },
  inactive:          { fr: 'Inactive', en: 'Inactive', ar: 'غير نشطة', wo: 'Aktif woo', bm: 'Baara woo', ff: 'Goongɗinaaka', sw: 'Haifanyi kazi', pt: 'Inativa' },
  globale:           { fr: 'Globale', en: 'Global', ar: 'عامة', wo: 'Bu dëkk', bm: 'Bɛɛ la', ff: 'Koyɗe fof', sw: 'Jumla', pt: 'Global' },
  sur_produit:       { fr: 'Sur produit', en: 'On product', ar: 'على المنتج', wo: 'Ci benn-benn', bm: 'Joli kan', ff: 'E dewe', sw: 'Kwenye bidhaa', pt: 'Em produto' },
  modifier_promo:    { fr: 'Modifier la promo', en: 'Edit promotion', ar: 'تعديل العرض', wo: 'Seet promotion bi', bm: 'Promotion yɛlɛma', ff: 'Waylude promotion', sw: 'Hariri ofa', pt: 'Editar promoção' },
  total_promos:      { fr: 'Total promos', en: 'Total promos', ar: 'إجمالي العروض', wo: 'Total promotions', bm: 'Promotions bɛɛ', ff: 'Promotions fof', sw: 'Jumla ya ofa', pt: 'Total de promoções' },
  par_produit:       { fr: 'Par produit', en: 'Per product', ar: 'حسب المنتج', wo: 'Bu benn-benn', bm: 'Joli bɛɛ', ff: 'Ko dewe', sw: 'Kwa bidhaa', pt: 'Por produto' },
  pourcentage:       { fr: 'Pourcentage', en: 'Percentage', ar: 'نسبة مئوية', wo: 'Pourcentage', bm: 'Cɛman', ff: 'Ceedol', sw: 'Asilimia', pt: 'Percentagem' },
  montant_fixe:      { fr: 'Montant fixe', en: 'Fixed amount', ar: 'مبلغ ثابت', wo: 'Xaalis bu dëkk', bm: 'Wari dɔgɔ', ff: 'Njuɓɓudi deeɗunde', sw: 'Kiasi kisichobadilika', pt: 'Valor fixo' },
  aucune_promo:      { fr: 'Aucune promotion', en: 'No promotion', ar: 'لا توجد عروض', wo: 'Amul promotion', bm: 'Promotion ma sɔrɔ', ff: 'Alaa promotions', sw: 'Hakuna ofa', pt: 'Nenhuma promoção' },
  titre_promo:       { fr: 'Titre *', en: 'Title *', ar: 'العنوان *', wo: 'Titu *', bm: 'Tɔgɔ *', ff: 'Tinndi *', sw: 'Kichwa *', pt: 'Título *' },
  type_reduction:    { fr: 'Type de réduction', en: 'Discount type', ar: 'نوع الخصم', wo: 'Xam-xam réduction', bm: 'Dɔgɔ jɔli', ff: 'Lenyol ceerngal', sw: 'Aina ya punguzo', pt: 'Tipo de desconto' },
  valeur:            { fr: 'Valeur', en: 'Value', ar: 'القيمة', wo: 'Njëg', bm: 'Nafa', ff: 'Njuɓɓudi', sw: 'Thamani', pt: 'Valor' },
  promo_globale:     { fr: 'Promotion globale', en: 'Global promotion', ar: 'عرض شامل', wo: 'Promotion bu dëkk', bm: 'Promotion bɛɛ la', ff: 'Promotion koyɗe fof', sw: 'Ofa la jumla', pt: 'Promoção global' },
  applique_tous:     { fr: "S'applique à tous les produits", en: 'Applies to all products', ar: 'ينطبق على جميع المنتجات', wo: 'Dafa am ci benn-benn yépp', bm: 'Joli bɛɛ la', ff: 'Ko dewe fof', sw: 'Inatumika kwa bidhaa zote', pt: 'Aplica-se a todos os produtos' },
  creer:             { fr: 'Créer', en: 'Create', ar: 'إنشاء', wo: 'Sos', bm: 'Sɔrɔ', ff: 'Fuɗɗirde', sw: 'Unda', pt: 'Criar' },

  // ── Employés ─────────────────────────────────────────────────────────────────
  employes:          { fr: 'Employés',                en: 'Employees',           ar: 'الموظفون',              wo: 'Liggéeykat yi',        bm: 'Baarakɛlaw',          ff: 'Gollorɓe',            sw: 'Wafanyakazi',             pt: 'Funcionários' },
  ajouter_employe:   { fr: 'Ajouter un employé',      en: 'Add employee',        ar: 'إضافة موظف',            wo: 'Yokk liggéeykat',      bm: 'Baarakɛla fara',      ff: 'Ɓeydu gollo',         sw: 'Ongeza mfanyakazi',       pt: 'Adicionar funcionário' },
  poste:             { fr: 'Poste',                    en: 'Position',            ar: 'المنصب',                wo: 'Liggéey',              bm: 'Sariya',              ff: 'Golle',               sw: 'Cheo',                    pt: 'Cargo' },
  salaire:           { fr: 'Salaire',                  en: 'Salary',              ar: 'الراتب',                wo: 'Jabar',                bm: 'Sariyabɔli',          ff: 'Lifaaji',             sw: 'Mshahara',                pt: 'Salário' },
  salaire_mensuel:   { fr: 'Salaire mensuel',          en: 'Monthly salary',      ar: 'الراتب الشهري',         wo: 'Jabar bu weer',        bm: 'Kalo sariyabɔli',     ff: 'Lifaaji lawn',        sw: 'Mshahara wa kila mwezi',  pt: 'Salário mensal' },
  paiement_salaire:  { fr: 'Paiement salaire',         en: 'Salary payment',      ar: 'دفع الراتب',            wo: 'Fey jabar',            bm: 'Sariyabɔli sara',     ff: 'Faɗɗude lifaaji',     sw: 'Malipo ya mshahara',      pt: 'Pagamento de salário' },
  mois_concerne:     { fr: 'Mois concerné',            en: 'Concerned month',     ar: 'الشهر المعني',          wo: 'Weer bi',              bm: 'Kaloba',              ff: 'Lewru ngol',          sw: 'Mwezi unaohusika',        pt: 'Mês referente' },
  inactif:           { fr: 'Inactif',                  en: 'Inactive',            ar: 'غير نشط',               wo: 'Defu dem',             bm: 'Kɛnɛmakɔ',           ff: 'Dañɓe',               sw: 'Amefungwa',               pt: 'Inativo' },
  activer:           { fr: 'Activer',                  en: 'Activate',            ar: 'تفعيل',                 wo: 'Daldi',                bm: 'Dali',                ff: 'Hɓitta',              sw: 'Wezesha',                 pt: 'Ativar' },
  desactiver:        { fr: 'Désactiver',               en: 'Deactivate',          ar: 'تعطيل',                 wo: 'Taxaw',                bm: 'Dabɔ',                ff: 'Haɓɓita',             sw: 'Lemaza',                  pt: 'Desativar' },

  // ── Dettes anciennes ──────────────────────────────────────────────────────────
  dettes_anciennes:  { fr: 'Dettes anciennes',         en: 'Old debts',           ar: 'الديون القديمة',        wo: 'Njaay yi',             bm: 'Jatigɛya kɔrɔw',     ff: 'Jimre kuuɓe',         sw: 'Madeni ya zamani',        pt: 'Dívidas antigas' },
  creancier:         { fr: 'Créancier',                 en: 'Creditor',            ar: 'الدائن',                wo: 'Jëgën bi',             bm: 'Dajalan',             ff: 'Lamparaajo',          sw: 'Mdai',                    pt: 'Credor' },
  montant_total:     { fr: 'Montant total',             en: 'Total amount',        ar: 'المبلغ الإجمالي',       wo: 'Xaalis bu dëkk',       bm: 'Jatebɔli ye bɛɛ',    ff: 'Hakke fof',           sw: 'Jumla',                   pt: 'Valor total' },
  montant_regle:     { fr: 'Montant réglé',             en: 'Paid amount',         ar: 'المبلغ المدفوع',        wo: 'Xaalis fey',           bm: 'Jatebɔli sara',       ff: 'Hakke halfinangal',   sw: 'Kilicholipwa',            pt: 'Valor pago' },
  reglement:         { fr: 'Règlement',                 en: 'Settlement',          ar: 'تسوية',                 wo: 'Fey bi',               bm: 'Jatebɔli sara',       ff: 'Halfinangal',         sw: 'Makubaliano',             pt: 'Liquidação' },
  ajouter_reglement: { fr: 'Ajouter un règlement',     en: 'Add settlement',      ar: 'إضافة تسوية',           wo: 'Yokk fey',             bm: 'Jatebɔli sara fara',  ff: 'Ɓeydu halfinangal',   sw: 'Ongeza makubaliano',      pt: 'Adicionar pagamento' },
  solde:             { fr: 'Soldé',                     en: 'Settled',             ar: 'مسوَّى',                wo: 'Fey',                  bm: 'Sara',                ff: 'Halfini',             sw: 'Imelipwa',                pt: 'Saldado' },
  en_retard:         { fr: 'En retard',                 en: 'Late',                ar: 'متأخر',                 wo: 'Yem ci kanam',         bm: 'Kɔnɔ yɛn',           ff: 'Ɓolɗo',               sw: 'Imechelewa',              pt: 'Atrasado' },

  // ── Comptes bancaires ─────────────────────────────────────────────────────────
  comptes_bancaires: { fr: 'Comptes bancaires',         en: 'Bank accounts',       ar: 'الحسابات البنكية',      wo: 'Konte yiy jaŋ xaalis', bm: 'Banki kunto w',       ff: 'Kontooji banki',      sw: 'Akaunti za benki',        pt: 'Contas bancárias' },
  compte:            { fr: 'Compte',                    en: 'Account',             ar: 'حساب',                  wo: 'Konte',                bm: 'Kunto',               ff: 'Konto',               sw: 'Akaunti',                 pt: 'Conta' },
  solde_compte:      { fr: 'Solde',                     en: 'Balance',             ar: 'الرصيد',                wo: 'Xaalis bu am',         bm: 'Kuntobɔli',           ff: 'Reste',               sw: 'Salio',                   pt: 'Saldo' },
  depot_compte:      { fr: 'Dépôt',                     en: 'Deposit',             ar: 'إيداع',                 wo: 'Dëkk xaalis',          bm: 'Dɔnitali',            ff: 'Hollitde',            sw: 'Amana',                   pt: 'Depósito' },
  retrait_compte:    { fr: 'Retrait',                   en: 'Withdrawal',          ar: 'سحب',                   wo: 'Jël xaalis',           bm: 'Bɔlili',              ff: 'Waɗɗude',             sw: 'Kutoa',                   pt: 'Saque' },
  operations:        { fr: 'Opérations',                en: 'Operations',          ar: 'العمليات',              wo: 'Liggéeyu wàllu',       bm: 'Kɛtaw',               ff: 'Golɗe',               sw: 'Shughuli',                pt: 'Operações' },

  // ── Objectifs fournisseurs ────────────────────────────────────────────────────
  objectifs_fournisseur: { fr: 'Objectifs fournisseurs', en: 'Supplier goals',    ar: 'أهداف الموردين',        wo: 'Bind yiy naan',        bm: 'Jagomafili batɔw',    ff: 'Haajuuji jowtiɗe',   sw: 'Malengo ya wasambazaji',  pt: 'Metas de fornecedores' },
  objectif:          { fr: 'Objectif',                  en: 'Goal',                ar: 'الهدف',                 wo: 'Bind',                 bm: 'Batɔ',                ff: 'Haaju',               sw: 'Lengo',                   pt: 'Meta' },
  progression:       { fr: 'Progression',               en: 'Progress',            ar: 'التقدم',                wo: 'Yéeg',                 bm: 'Taamali',             ff: 'Ɓeydugol',            sw: 'Maendeleo',               pt: 'Progresso' },
  bonus_attendu:     { fr: 'Bonus prévu',               en: 'Expected bonus',      ar: 'المكافأة المتوقعة',     wo: 'Ñëlar ñëppi',          bm: 'Niyɔrɔli',            ff: 'Nafaare jokki',       sw: 'Bonasi inayotarajiwa',    pt: 'Bônus esperado' },
  objectif_atteint:  { fr: 'Objectif atteint',          en: 'Goal reached',        ar: 'تم تحقيق الهدف',        wo: 'Bind am',              bm: 'Batɔ sɔrɔ',           ff: 'Haaju heɓaa',         sw: 'Lengo limefikiwa',        pt: 'Meta atingida' },

  // ── Vendeurs ──────────────────────────────────────────────────────────────────
  vendeurs:          { fr: 'Vendeurs',                  en: 'Sellers',             ar: 'البائعون',              wo: 'Jënd yi',              bm: 'Jagatɔw',             ff: 'Jiyɓe',               sw: 'Wauzaji',                 pt: 'Vendedores' },
  ajouter_vendeur:   { fr: 'Ajouter vendeur',           en: 'Add seller',          ar: 'إضافة بائع',            wo: 'Yokk jënd',            bm: 'Jagatɔ fara',         ff: 'Ɓeydu jiyɗo',         sw: 'Ongeza muuzaji',          pt: 'Adicionar vendedor' },
  nom_utilisateur:   { fr: 'Nom utilisateur',           en: 'Username',            ar: 'اسم المستخدم',          wo: 'Tur ci internet',       bm: 'Tɔgɔ',               ff: 'Innde jiyɗo',         sw: 'Jina la mtumiaji',        pt: 'Nome de usuário' },
  reinitialiser_mdp: { fr: 'Réinitialiser MDP',         en: 'Reset password',      ar: 'إعادة تعيين كلمة المرور', wo: 'Daldi xam-xam',      bm: 'Gundo kura',          ff: 'Gundo keɓal',         sw: 'Weka upya nenosiri',      pt: 'Redefinir senha' },

  // ── Tableau de bord ───────────────────────────────────────────────────────────
  tableau_de_bord:   { fr: 'Tableau de bord',           en: 'Dashboard',           ar: 'لوحة القيادة',          wo: 'Ndigël yi',            bm: 'Latigɛ segin',        ff: 'Binndi dow',          sw: 'Dashibodi',               pt: 'Painel' },
  bonjour:           { fr: 'Bonjour',                   en: 'Hello',               ar: 'مرحباً',                wo: 'Salaam',               bm: 'I ni tile',           ff: 'Jam waali',           sw: 'Habari',                  pt: 'Olá' },
  bonne_journee:     { fr: 'Bonne journée',             en: 'Good day',            ar: 'يوم سعيد',              wo: 'Yéegal jàmm',          bm: 'Tile ka di',          ff: 'Ñalawma jam',         sw: 'Siku njema',              pt: 'Boa tarde' },
  ventes_du_jour:    { fr: 'Ventes du jour',            en: "Today's sales",       ar: 'مبيعات اليوم',          wo: 'Jënd bu tey',          bm: 'Tile jagatɔliw',      ff: 'Yiyaaɓe hannde',      sw: 'Mauzo ya leo',            pt: 'Vendas do dia' },
  ca_du_jour:        { fr: 'CA du jour',                en: "Today's revenue",     ar: 'إيرادات اليوم',         wo: 'Xaalis bu tey',        bm: 'Tile marila',         ff: 'Kiseeki hannde',      sw: 'Mapato ya leo',           pt: 'Faturamento do dia' },
  alertes_stock:     { fr: 'Alertes stock',             en: 'Stock alerts',        ar: 'تنبيهات المخزون',       wo: 'Dëppoo ay',            bm: 'Tibila',              ff: 'Kawritooje mbaadiiji', sw: 'Tahadhari za hisa',      pt: 'Alertas de estoque' },
  accueil:           { fr: 'Accueil',                   en: 'Home',                ar: 'الرئيسية',              wo: 'Kër gi',               bm: 'So',                  ff: 'Galle',               sw: 'Nyumbani',                pt: 'Início' },
  voir_tout:         { fr: 'Voir tout',                 en: 'See all',             ar: 'عرض الكل',              wo: 'Xool yëp',             bm: 'Bɛɛ ye yeli',         ff: 'Yiy fof',             sw: 'Ona yote',                pt: 'Ver tudo' },
};

export function tr(key: string, lang: string): string {
  const entry = T[key];
  if (!entry) return key;
  return entry[lang as L] ?? entry['fr'] ?? key;
}
