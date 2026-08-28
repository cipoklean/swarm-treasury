import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { C } from './theme';

interface WalletState {
  address: string | null;
  chainId: number | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  provider: ethers.BrowserProvider | null;
  signer: ethers.Signer | null;
  connecting: boolean;
  error: string | null;
}

const DEFAULTS: WalletState = {
  address: null, chainId: null, connect: async () => {}, disconnect: () => {},
  provider: null, signer: null, connecting: false, error: null,
};

const Ctx = createContext<WalletState>(DEFAULTS);
export const useWallet = () => useContext(Ctx);

const BOT_CHAIN_ID = Number((import.meta as any).env?.VITE_CHAIN_ID) || 968;
const BOT_CHAIN_HEX = '0x' + BOT_CHAIN_ID.toString(16);
const EXPECTED_CHAIN_LABEL = BOT_CHAIN_ID === 677 ? 'BOT Chain Mainnet (677)' : 'BOT Chain Testnet (968)';

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      const eth = (window as any).ethereum;
      if (!eth) throw new Error('No injected wallet (MetaMask) found');
      const p = new ethers.BrowserProvider(eth);
      const net = await p.getNetwork();
      if (Number(net.chainId) !== BOT_CHAIN_ID) {
        try {
          await eth.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: BOT_CHAIN_HEX }],
          });
        } catch {
          throw new Error(`Please switch your wallet to ${EXPECTED_CHAIN_LABEL}`);
        }
      }
      await p.send('eth_requestAccounts', []);
      const s = await p.getSigner();
      const a = await s.getAddress();
      setProvider(p);
      setSigner(s);
      setAddress(a);
      setChainId(Number((await p.getNetwork()).chainId));
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setSigner(null);
    setProvider(null);
    setChainId(null);
  }, []);

  useEffect(() => {
    const eth = (window as any).ethereum;
    if (!eth || !eth.on) return;
    const onAcct = (accs: string[]) => (accs.length ? connect() : disconnect());
    const onChain = async () => {
      try {
        const net = await eth.request({ method: 'eth_chainId' });
        const newChainId = Number(net);
        setChainId(newChainId);
        setError(null);
        // If we landed on the expected chain, try to refresh the provider.
        // getNetwork() can throw NETWORK_ERROR during the transition — that's
        // fine, the existing provider is still usable on the new chain.
        if (newChainId === BOT_CHAIN_ID) {
          try {
            const p = new ethers.BrowserProvider(eth);
            const info = await p.getNetwork();
            setChainId(Number(info.chainId));
            setProvider(p);
            setSigner(await p.getSigner());
          } catch {
            // NETWORK_ERROR / transition in-flight — leave existing provider.
          }
        } else {
          setError(`Wrong network — expected ${EXPECTED_CHAIN_LABEL}`);
        }
      } catch {
        /* eth_chainId unavailable — ignore */
      }
    };
    eth.on('accountsChanged', onAcct);
    eth.on('chainChanged', onChain);
    return () => {
      eth.removeListener?.('accountsChanged', onAcct);
      eth.removeListener?.('chainChanged', onChain);
    };
  }, [connect, disconnect]);

  return (
    <Ctx.Provider value={{ address, chainId, connect, disconnect, provider, signer, connecting, error }}>
      {children}
    </Ctx.Provider>
  );
};

export const ConnectButton: React.FC = () => {
  const { address, connect, disconnect, connecting, error } = useWallet();
  if (address) {
    return (
      <button onClick={disconnect} style={btnStyle(C.secondary, true)} title="Disconnect">
        {short(address)}
      </button>
    );
  }
  return (
    <button onClick={connect} disabled={connecting} style={btnStyle(C.green, false)}>
      {connecting ? 'Connecting…' : 'Connect Wallet'}
    </button>
  );
};

const btnStyle = (color: string, ghost: boolean): React.CSSProperties => ({
  cursor: 'pointer',
  border: `1px solid ${ghost ? C.border : color + '66'}`,
  borderRadius: '9px',
  background: ghost ? 'transparent' : `linear-gradient(135deg, ${color}22, ${color}11)`,
  color: ghost ? C.text : color,
  fontWeight: 600,
  fontSize: '0.78rem',
  padding: '8px 14px',
  fontFamily: 'Inter, system-ui, sans-serif',
});

export default WalletProvider;
