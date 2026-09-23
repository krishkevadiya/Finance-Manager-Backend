import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
} from "typeorm";

import { Account } from "./Account";

@Entity("transactions")
export class Transaction {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 20 })
  type!: string; // income or expense

  @Column({
    type: "decimal",
    precision: 12,
    scale: 2,
  })
  amount!: number;

  @Column({ length: 100 })
  category!: string;

  @Column({ type: "text", nullable: true })
  description!: string | null;

  @Column({
    type: "date",
    default: () => "CURRENT_DATE",
  })
  transactionDate!: string;

  @ManyToOne(() => Account, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "accountId" })
  account!: Account;

  @CreateDateColumn()
  createdAt!: Date;
}