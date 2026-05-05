import { describe, it, expect } from 'vitest';
import {
  validateCommand,
  getAllowedCommands,
  isWriteCommand,
  hasStreamingFlags,
} from '../terminalValidation';

describe('terminalValidation', () => {
  describe('validateCommand', () => {
    describe('valid commands', () => {
      it('should allow get command', () => {
        const result = validateCommand('kubectl get pods');
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should allow describe command', () => {
        const result = validateCommand('kubectl describe pod nginx');
        expect(result.valid).toBe(true);
      });

      it('should allow logs command', () => {
        const result = validateCommand('kubectl logs nginx-pod');
        expect(result.valid).toBe(true);
      });

      it('should allow top command', () => {
        const result = validateCommand('kubectl top nodes');
        expect(result.valid).toBe(true);
      });

      it('should allow version command', () => {
        const result = validateCommand('kubectl version');
        expect(result.valid).toBe(true);
      });

      it('should allow commands with allowed flags', () => {
        const result = validateCommand('kubectl get pods -n default -o json');
        expect(result.valid).toBe(true);
      });

      it('should allow commands without kubectl prefix', () => {
        const result = validateCommand('get pods -n default');
        expect(result.valid).toBe(true);
      });
    });

    describe('blocked streaming flags', () => {
      it('should block --watch flag', () => {
        const result = validateCommand('kubectl get pods --watch');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Streaming commands');
        expect(result.error).toContain('--watch');
        expect(result.suggestion).toContain('Remove --watch');
      });

      it('should block -w short flag', () => {
        const result = validateCommand('kubectl get pods -w');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('-w');
      });

      it('should block --follow flag', () => {
        const result = validateCommand('kubectl logs nginx --follow');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('--follow');
      });

      it('should block -f short flag in logs command', () => {
        const result = validateCommand('kubectl logs nginx -f');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('-f');
      });

      it('should NOT block -f flag in apply command (file argument)', () => {
        // -f in 'kubectl apply -f' means file, not follow
        // But apply is still blocked as write command
        const result = validateCommand('kubectl apply -f deployment.yaml');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Write operations');
        expect(result.error).toContain('apply');
      });

      it('should block --watch-only flag', () => {
        const result = validateCommand('kubectl get pods --watch-only');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('--watch-only');
      });

      it('should block streaming flag with value', () => {
        const result = validateCommand('kubectl get pods --watch=true');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('--watch');
      });

      it('should block multiple streaming flags', () => {
        const result = validateCommand('kubectl logs nginx -f --watch');
        expect(result.valid).toBe(false);
        // Should catch at least one
        expect(result.error).toMatch(/(-f|--watch)/);
      });
    });

    describe('blocked write commands', () => {
      it('should block apply command', () => {
        const result = validateCommand('kubectl apply -f deployment.yaml');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Write operations');
        expect(result.error).toContain('apply');
        expect(result.suggestion).toContain('read-only');
      });

      it('should block create command', () => {
        const result = validateCommand('kubectl create deployment nginx --image=nginx');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('create');
      });

      it('should block delete command', () => {
        const result = validateCommand('kubectl delete pod nginx');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('delete');
      });

      it('should block edit command', () => {
        const result = validateCommand('kubectl edit deployment nginx');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('edit');
      });

      it('should block patch command', () => {
        const result = validateCommand('kubectl patch pod nginx -p \'{"spec":{}}\'');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('patch');
      });

      it('should block scale command', () => {
        const result = validateCommand('kubectl scale deployment nginx --replicas=3');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('scale');
      });

      it('should block exec command', () => {
        const result = validateCommand('kubectl exec -it nginx -- /bin/bash');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('exec');
      });

      it('should block port-forward command', () => {
        const result = validateCommand('kubectl port-forward nginx 8080:80');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('port-forward');
      });
    });

    describe('invalid input', () => {
      it('should reject empty command', () => {
        const result = validateCommand('');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('cannot be empty');
      });

      it('should reject whitespace-only command', () => {
        const result = validateCommand('   ');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('cannot be empty');
      });

      it('should reject unknown command', () => {
        const result = validateCommand('kubectl unknown-command');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('not recognized');
        expect(result.suggestion).toContain('read-only');
      });
    });

    describe('edge cases', () => {
      it('should handle command with extra whitespace', () => {
        const result = validateCommand('  kubectl   get   pods  ');
        expect(result.valid).toBe(true);
      });

      it('should be case-sensitive for subcommands', () => {
        const result = validateCommand('kubectl GET pods');
        expect(result.valid).toBe(false); // GET (uppercase) not in allowed list
      });

      it('should handle command with namespace flag', () => {
        const result = validateCommand('kubectl get pods -n kube-system');
        expect(result.valid).toBe(true);
      });

      it('should handle command with output format', () => {
        const result = validateCommand('kubectl get pods -o wide');
        expect(result.valid).toBe(true);
      });
    });
  });

  describe('getAllowedCommands', () => {
    it('should return array of allowed commands', () => {
      const commands = getAllowedCommands();
      expect(Array.isArray(commands)).toBe(true);
      expect(commands.length).toBeGreaterThan(0);
    });

    it('should include common read-only commands', () => {
      const commands = getAllowedCommands();
      expect(commands).toContain('get');
      expect(commands).toContain('describe');
      expect(commands).toContain('logs');
      expect(commands).toContain('version');
    });

    it('should return sorted array', () => {
      const commands = getAllowedCommands();
      const sorted = [...commands].sort();
      expect(commands).toEqual(sorted);
    });

    it('should not include write commands', () => {
      const commands = getAllowedCommands();
      expect(commands).not.toContain('delete');
      expect(commands).not.toContain('apply');
      expect(commands).not.toContain('create');
    });
  });

  describe('isWriteCommand', () => {
    it('should return true for write commands', () => {
      expect(isWriteCommand('delete')).toBe(true);
      expect(isWriteCommand('apply')).toBe(true);
      expect(isWriteCommand('create')).toBe(true);
      expect(isWriteCommand('patch')).toBe(true);
    });

    it('should return false for read commands', () => {
      expect(isWriteCommand('get')).toBe(false);
      expect(isWriteCommand('describe')).toBe(false);
      expect(isWriteCommand('logs')).toBe(false);
    });

    it('should return false for unknown commands', () => {
      expect(isWriteCommand('unknown')).toBe(false);
    });
  });

  describe('hasStreamingFlags', () => {
    it('should return true for commands with --watch', () => {
      expect(hasStreamingFlags('kubectl get pods --watch')).toBe(true);
    });

    it('should return true for commands with -w', () => {
      expect(hasStreamingFlags('kubectl get pods -w')).toBe(true);
    });

    it('should return true for commands with --follow', () => {
      expect(hasStreamingFlags('kubectl logs nginx --follow')).toBe(true);
    });

    it('should return true for commands with -f', () => {
      expect(hasStreamingFlags('kubectl logs nginx -f')).toBe(true);
    });

    it('should return false for commands without streaming flags', () => {
      expect(hasStreamingFlags('kubectl get pods')).toBe(false);
      expect(hasStreamingFlags('kubectl get pods -n default')).toBe(false);
    });

    it('should return true for streaming flag with value', () => {
      expect(hasStreamingFlags('kubectl get pods --watch=true')).toBe(true);
    });
  });
});
