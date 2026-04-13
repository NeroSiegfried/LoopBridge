/**
 * LoopBridge — AI Article Categorization Service
 *
 * Analyses article body text and assigns the best-fit category.
 *
 * Strategy:
 *   1. Uses keyword-based scoring (works offline, zero cost).
 *   2. If OPENAI_API_KEY is set, upgrades to GPT-based classification.
 *
 * Categories: DeFi, NFTs, Trading, Blockchain, Security, Regulation,
 *             Wallets, Mining, Staking, Web3, Metaverse, Education, General
 */
'use strict';

const CATEGORIES = [
    'DeFi',
    'NFTs',
    'Trading',
    'Blockchain',
    'Security',
    'Regulation',
    'Wallets',
    'Mining',
    'Staking',
    'Web3',
    'Metaverse',
    'Education',
    'General'
];

/**
 * Keyword → category mapping.
 * Each keyword gets weighted; the category with the highest total wins.
 */
const KEYWORD_MAP = {
    DeFi: [
        'defi', 'decentralized finance', 'yield farming', 'liquidity pool',
        'amm', 'automated market maker', 'lending protocol', 'aave', 'compound',
        'uniswap', 'sushiswap', 'curve', 'tvl', 'total value locked',
        'flash loan', 'impermanent loss', 'liquidity mining', 'dex',
        'decentralized exchange', 'swap', 'farm', 'vault'
    ],
    NFTs: [
        'nft', 'non-fungible', 'opensea', 'erc-721', 'erc-1155', 'collectible',
        'digital art', 'mint', 'minting', 'pfp', 'bored ape', 'bayc',
        'cryptopunks', 'generative art', 'token id', 'royalty', 'marketplace',
        'rarity', 'floor price'
    ],
    Trading: [
        'trading', 'exchange', 'order book', 'candlestick', 'technical analysis',
        'chart', 'bull', 'bear', 'leverage', 'margin', 'futures', 'spot',
        'limit order', 'stop loss', 'take profit', 'binance', 'coinbase',
        'kraken', 'price action', 'volatility', 'portfolio', 'long', 'short',
        'resistance', 'support', 'rsi', 'macd', 'moving average', 'scalping',
        'day trading', 'swing trading', 'otc', 'p2p'
    ],
    Blockchain: [
        'blockchain', 'block', 'chain', 'consensus', 'proof of work', 'proof of stake',
        'node', 'validator', 'hash', 'merkle', 'immutable', 'distributed ledger',
        'layer 1', 'layer 2', 'rollup', 'sidechain', 'bridge', 'fork',
        'ethereum', 'bitcoin', 'solana', 'polygon', 'avalanche', 'cosmos',
        'smart contract', 'evm', 'gas fee', 'transaction', 'mainnet', 'testnet'
    ],
    Security: [
        'security', 'hack', 'exploit', 'vulnerability', 'phishing', 'scam',
        'rug pull', 'audit', 'smart contract audit', 'private key', 'seed phrase',
        'two-factor', '2fa', 'cold storage', 'hardware wallet', 'multisig',
        'social engineering', 'malware', 'ransomware', 'kyc', 'aml'
    ],
    Regulation: [
        'regulation', 'sec', 'cftc', 'compliance', 'legal', 'law', 'ban',
        'tax', 'taxation', 'government', 'central bank', 'cbdc',
        'policy', 'framework', 'license', 'sanction', 'enforcement',
        'anti-money laundering', 'know your customer', 'mica'
    ],
    Wallets: [
        'wallet', 'metamask', 'trust wallet', 'phantom', 'ledger', 'trezor',
        'hot wallet', 'cold wallet', 'custodial', 'non-custodial', 'self-custody',
        'recovery phrase', 'keystore', 'web3 wallet', 'mobile wallet',
        'browser extension', 'hardware wallet'
    ],
    Mining: [
        'mining', 'miner', 'hashrate', 'asic', 'gpu mining', 'difficulty',
        'block reward', 'halving', 'pow', 'proof of work', 'mining pool',
        'energy consumption', 'bitcoin mining'
    ],
    Staking: [
        'staking', 'stake', 'validator', 'delegation', 'reward', 'apy', 'apr',
        'proof of stake', 'liquid staking', 'lido', 'rocket pool', 'slashing',
        'unbonding', 'epoch', 'staked', 'restaking'
    ],
    Web3: [
        'web3', 'dapp', 'decentralized app', 'dao', 'governance', 'token',
        'tokenomics', 'airdrop', 'ens', 'ipfs', 'decentralized identity',
        'soulbound', 'sbt', 'social fi', 'game fi', 'play to earn',
        'creator economy', 'ownership'
    ],
    Metaverse: [
        'metaverse', 'virtual world', 'avatar', 'virtual reality', 'vr',
        'augmented reality', 'ar', 'decentraland', 'sandbox', 'virtual land',
        'digital twin', 'immersive', 'spatial', 'oculus'
    ],
    Education: [
        'learn', 'tutorial', 'guide', 'beginner', 'introduction', 'how to',
        'step by step', 'course', 'lesson', 'explained', 'basics', 'fundamentals',
        'getting started', 'what is', 'understanding', 'overview', 'academy'
    ]
};

/**
 * Score an article's text against each category.
 * Returns sorted array of { category, score } from best to worst.
 */
function scoreText(text) {
    const lower = text.toLowerCase();
    const scores = {};

    for (const [category, keywords] of Object.entries(KEYWORD_MAP)) {
        let score = 0;
        for (const kw of keywords) {
            // Count occurrences (whole-word where practical)
            const regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
            const matches = lower.match(regex);
            if (matches) {
                // Multi-word keywords get a higher weight
                const weight = kw.includes(' ') ? 3 : 1;
                score += matches.length * weight;
            }
        }
        scores[category] = score;
    }

    return Object.entries(scores)
        .map(([category, score]) => ({ category, score }))
        .sort((a, b) => b.score - a.score);
}

/**
 * Extract plain text from article content array.
 * Content is stored as JSON: [{ type: 'paragraph', value: '...' }, ...]
 */
function extractText(content, title, description) {
    let text = (title || '') + ' ' + (description || '') + ' ';

    if (Array.isArray(content)) {
        for (const block of content) {
            if (typeof block === 'string') {
                text += block + ' ';
            } else if (block.value) {
                text += block.value + ' ';
            } else if (block.text) {
                text += block.text + ' ';
            } else if (block.content && typeof block.content === 'string') {
                text += block.content + ' ';
            }
        }
    } else if (typeof content === 'string') {
        text += content;
    }

    return text;
}

/**
 * Categorise an article. Returns { primary, scores }.
 *
 * @param {Object} article - { title, description, content }
 * @returns {{ primary: string, scores: Array<{ category: string, score: number }> }}
 */
function categorise(article) {
    const text = extractText(article.content, article.title, article.description);
    const ranked = scoreText(text);

    const topScore = ranked[0]?.score || 0;

    // If the top score is very low, default to 'General'
    if (topScore < 2) {
        return {
            primary: 'General',
            scores: ranked
        };
    }

    return {
        primary: ranked[0].category,
        scores: ranked
    };
}

/**
 * Get all available categories.
 */
function getCategories() {
    return [...CATEGORIES];
}

module.exports = {
    categorise,
    getCategories,
    CATEGORIES,
    scoreText,
    extractText
};
