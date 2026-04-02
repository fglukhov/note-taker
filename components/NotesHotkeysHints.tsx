import React from 'react';
import { useSyncExternalStore } from 'react';
import styles from '@/components/NotesList.module.scss';

const NotesHotkeysHints: React.FC = () => {
  const isMac = useSyncExternalStore(
    () => () => {},
    () => /Mac|iPhone|iPad|iPod/i.test(navigator.platform),
    () => false,
  );

  return (
    <div className={styles.sidebar_hints}>
      <div className={styles.hints_list}>
        <div className={styles.hints_item}>
          <div className={styles.hints_item_key}>
            <div className={styles.key}>{isMac ? 'Return' : 'Enter'}</div>
          </div>
          <div className={styles.hints_item_descr}>Add note</div>
        </div>
        <div className={styles.hints_item}>
          <div className={styles.hints_item_key}>
            <div className={styles.key}>
              {isMac ? '⌥ + Return' : 'Alt + Enter'}
            </div>
          </div>
          <div className={styles.hints_item_descr}>Add above</div>
        </div>
        <div className={styles.hints_item}>
          <div className={styles.hints_item_key}>
            <div className={styles.key}>
              {isMac ? '⇧ + Return' : 'Shift + Enter'}
            </div>
          </div>
          <div className={styles.hints_item_descr}>Add a sub-item</div>
        </div>
        <div className={styles.hints_item}>
          <div className={styles.hints_item_key}>
            <div className={styles.key}>ee</div>
          </div>
          <div className={styles.hints_item_descr}>Edit title</div>
        </div>
        <div className={styles.hints_item}>
          <div className={styles.hints_item_key}>
            <div className={styles.key}>nn</div>
          </div>
          <div className={styles.hints_item_descr}>Open note</div>
        </div>
        <div className={styles.hints_item}>
          <div className={styles.hints_item_key}>
            <div className={styles.key}>↑</div>
            <div className={styles.key}>↓</div>
          </div>
          <div className={styles.hints_item_descr}>Navigate</div>
        </div>
        <div className={styles.hints_item}>
          <div className={styles.hints_item_key}>
            <div className={styles.key}>←</div>
            <div className={styles.key}>→</div>
          </div>
          <div className={styles.hints_item_descr}>Collapse/expand</div>
        </div>
        <div className={styles.hints_item}>
          <div className={styles.hints_item_key}>
            <div className={styles.key}>{isMac ? '⌘ + →' : 'Ctrl + →'}</div>
          </div>
          <div className={styles.hints_item_descr}>Indent</div>
        </div>
        <div className={styles.hints_item}>
          <div className={styles.hints_item_key}>
            <div className={styles.key}>{isMac ? '⌘ + ←' : 'Ctrl + ←'}</div>
          </div>
          <div className={styles.hints_item_descr}>Outdent</div>
        </div>
        <div className={styles.hints_item}>
          <div className={styles.hints_item_key}>
            <div className={styles.key}>{isMac ? '⌘ + ↑' : 'Ctrl + ↑'}</div>
            <div className={styles.key}>{isMac ? '⌘ + ↓' : 'Ctrl + ↓'}</div>
          </div>
          <div className={styles.hints_item_descr}>Reorder notes</div>
        </div>

        <div className={styles.hints_item}>
          <div className={styles.hints_item_key}>
            <div className={styles.key}>{isMac ? 'Space' : 'Spacebar'}</div>
          </div>
          <div className={styles.hints_item_descr}>Complete/reopen</div>
        </div>
        <div className={styles.hints_item}>
          <div className={styles.hints_item_key}>
            <div className={styles.key}>{isMac ? 'fn + ⌫' : 'Del'}</div>
          </div>
          <div className={styles.hints_item_descr}>Delete</div>
        </div>
        <div className={styles.hints_item}>
          <div className={styles.hints_item_key}>
            <div className={styles.key}>
              <span className={styles.priority_digit_1}>1</span>
            </div>
            <div className={styles.key}>
              <span className={styles.priority_digit_2}>2</span>
            </div>
            <div className={styles.key}>
              <span className={styles.priority_digit_3}>3</span>
            </div>
          </div>
          <div className={styles.hints_item_descr}>Set/unset priority</div>
        </div>
        <div className={styles.hints_item}>
          <div className={styles.hints_item_key}>
            <div className={styles.key}>{isMac ? '⌘ + B' : 'Ctrl + B'}</div>
          </div>
          <div className={styles.hints_item_descr}>Toggle bold</div>
        </div>
      </div>
    </div>
  );
};

export default NotesHotkeysHints;
