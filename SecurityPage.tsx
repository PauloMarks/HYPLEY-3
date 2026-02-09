import React from 'react';

const SecurityPage = () => {
    return (
        <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans antialiased">
            <div className="container mx-auto px-4 py-12">
                <header className="text-center mb-12 relative">
                    <a href="#" className="absolute top-2 left-0 flex items-center text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)] transition-colors text-lg font-medium z-10">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                        Voltar
                    </a>
                    <h1 className="text-6xl font-extrabold drop-shadow-[0_4px_15px_rgba(0,183,255,0.4)]">
                        <span className="text-white">Gideão</span><span className="text-[var(--accent-primary)]">IA</span>
                    </h1>
                    <h2 className="text-3xl font-bold mt-2 text-white">Segurança e Privacidade</h2>
                    <p className="text-lg text-[var(--text-secondary)] mt-4 max-w-3xl mx-auto">Entenda como protegemos seus dados e garantimos sua privacidade.</p>
                </header>

                <main className="max-w-4xl mx-auto prose prose-lg prose-invert prose-p:text-[var(--text-secondary)] prose-headings:text-[var(--text-primary)] prose-strong:text-white prose-ul:text-[var(--text-secondary)] prose-li:marker:text-[var(--accent-primary)] prose-code:text-cyan-400 prose-code:before:content-none prose-code:after:content-none prose-blockquote:border-[var(--accent-primary)] prose-blockquote:text-gray-400">
                    <h3>Visão Geral de Segurança</h3>
                    <p>A sua segurança e a privacidade dos seus dados são nossa principal prioridade. Descrevemos abaixo as medidas que tomamos para proteger suas informações.</p>

                    <h4>Nossa Arquitetura de Segurança</h4>
                    <ul>
                        <li><strong>Criptografia em Trânsito:</strong> Toda a comunicação entre seu navegador, nossos servidores e as APIs do Google (Firebase e Gemini) é criptografada usando TLS (HTTPS), o padrão ouro para segurança na web.</li>
                        <li><strong>Armazenamento Seguro:</strong> Suas informações de perfil e histórico de conversas em texto são armazenados no Firestore, um banco de dados do Google, e protegidos por regras de segurança rigorosas que garantem que apenas você possa acessar seus próprios dados.</li>
                        <li><strong>Processamento de Mídia:</strong> Os dados de áudio e imagem da sua tela são processados em tempo real pela API do Google Gemini. Esses dados não são armazenados em nossos servidores após o término da sessão de processamento.</li>
                        <li><strong>Processamento de Pagamento:</strong> Utilizamos a Kiwify para processar pagamentos. Nós não armazenamos, processamos ou temos acesso aos detalhes do seu cartão de crédito.</li>
                    </ul>

                    <h4>Sua Responsabilidade</h4>
                    <ul>
                        <li><strong>Senha Forte:</strong> Use uma senha única e forte para sua conta Gideão IA.</li>
                        <li><strong>Consciência de Compartilhamento:</strong> Lembre-se que Gideão analisa o que está visível na sua tela. Evite compartilhar telas que contenham informações pessoais sensíveis, como senhas, documentos ou informações financeiras.</li>
                        <li><strong>Logout Seguro:</strong> Sempre saia da sua conta ao usar computadores compartilhados ou públicos.</li>
                    </ul>
                </main>

                <footer className="text-center mt-16 text-[var(--text-secondary)] text-sm">
                    <p>&copy; 2024 Gideão IA. Todos os direitos reservados.</p>
                </footer>
            </div>
        </div>
    );
};

export default SecurityPage;
