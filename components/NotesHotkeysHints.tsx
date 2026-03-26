import React from 'react';
import styles from '@/components/NotesList.module.scss';

const NotesHotkeysHints: React.FC = () => {
  return (
    <div className={styles.sidebar_hints}>
      <div className={styles.hints_list}>
        <div className={styles.hints_item}>
          <div className={styles.hints_item_key}>
            <div className={styles.key}>Enter</div>
          </div>
          <div className={styles.hints_item_descr}>Add note</div>
        </div>
        <div className={styles.hints_item}>
          <div className={styles.hints_item_key}>
            <div className={styles.key}>Alt + Enter</div>
          </div>
          <div className={styles.hints_item_descr}>Add above</div>
        </div>
        <div className={styles.hints_item}>
          <div className={styles.hints_item_key}>
            <div className={styles.key}>Shift + Enter</div>
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
            <div className={styles.key}>Ctrl + →</div>
          </div>
          <div className={styles.hints_item_descr}>Indent</div>
        </div>
        <div className={styles.hints_item}>
          <div className={styles.hints_item_key}>
            <div className={styles.key}>Ctrl + ←</div>
          </div>
          <div className={styles.hints_item_descr}>Outdent</div>
        </div>
        <div className={styles.hints_item}>
          <div className={styles.hints_item_key}>
            <div className={styles.key}>Ctrl + ↑</div>
            <div className={styles.key}>Ctrl + ↓</div>
          </div>
          <div className={styles.hints_item_descr}>Reorder notes</div>
        </div>

        <div className={styles.hints_item}>
          <div className={styles.hints_item_key}>
            <div className={styles.key}>Spacebar</div>
          </div>
          <div className={styles.hints_item_descr}>Complete/reopen</div>
        </div>
        <div className={styles.hints_item}>
          <div className={styles.hints_item_key}>
            <div className={styles.key}>Del</div>
          </div>
          <div className={styles.hints_item_descr}>Delete</div>
        </div>
      </div>
    </div>
  );
};

export default NotesHotkeysHints;
