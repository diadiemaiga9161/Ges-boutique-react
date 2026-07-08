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
};

export function tr(key: string, lang: string): string {
  const entry = T[key];
  if (!entry) return key;
  return entry[lang as L] ?? entry['fr'] ?? key;
}
