import { useState } from 'react';
import { Check, Copy, Download, KeyRound, ShieldAlert } from 'lucide-react';
import { Button, Modal, useToast } from './Ui';
import { downloadText } from '../format';

export function RecoveryKeyModal({
  recoveryKey,
  onDone,
}: {
  recoveryKey: string;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(recoveryKey);
      setCopied(true);
      toast('Chave copiada para a área de transferência.');
      window.setTimeout(() => setCopied(false), 2400);
    } catch {
      toast('Não foi possível copiar automaticamente. Selecione o código e copie.', 'error');
    }
  };

  return (
    <Modal
      open
      onClose={() => undefined}
      dismissible={false}
      size="md"
      eyebrow="Segurança"
      title="Guarde sua chave de recuperação"
      subtitle="Ela é a única forma de recuperar o acesso se você esquecer a senha."
      footer={
        <Button full disabled={!saved} onClick={onDone} icon={<Check size={16} />}>
          Continuei, já guardei a chave
        </Button>
      }
    >
      <div className="recovery-content">
        <div className="recovery-icon">
          <KeyRound size={22} />
        </div>
        <p className="recovery-lead">
          Anote ou baixe esta chave e mantenha em um lugar seguro. Por segurança, ela{' '}
          <strong>não será mostrada novamente</strong>.
        </p>
        <div className="recovery-code" aria-label="Chave de recuperação">
          {recoveryKey}
        </div>
        <div className="recovery-actions">
          <Button variant="secondary" size="sm" icon={copied ? <Check size={15} /> : <Copy size={15} />} onClick={copy}>
            {copied ? 'Copiada' : 'Copiar chave'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={<Download size={15} />}
            onClick={() => {
              downloadText(
                'controles-da-silmara-chave-de-recuperacao.txt',
                `Chave de recuperação — Controles da Silmara\n\n${recoveryKey}\n\nGuarde este arquivo em um lugar seguro.\nAcesse os Controles da Silmara e use a opção "Entrar com chave de recuperação".\nGerada em ${new Date().toLocaleString('pt-BR')}.\n`,
              );
              toast('Arquivo da chave baixado.');
            }}
          >
            Baixar .txt
          </Button>
        </div>
        <div className="recovery-warning">
          <ShieldAlert size={17} />
          <p>
            Sem a senha e sem esta chave, o acesso não pode ser recuperado. Você pode gerar uma nova
            chave depois, em Ajustes → Segurança.
          </p>
        </div>
        <label className="checkline">
          <input
            type="checkbox"
            checked={saved}
            onChange={(event) => setSaved(event.target.checked)}
          />
          <span className="checkline-box">{saved ? <Check size={13} /> : null}</span>
          <span>Guardei a chave em um lugar seguro e entendo que ela não será exibida novamente.</span>
        </label>
      </div>
    </Modal>
  );
}
