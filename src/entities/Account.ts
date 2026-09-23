import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
} from "typeorm";

import { User } from "./User";

@Entity("accounts")
export class Account {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 100 })
  name!: string;

  @Column({ length: 50 })
  type!: string;

  @Column({
    type: "decimal",
    precision: 12,
    scale: 2,
    default: 0,
  })
  balance!: number;

  @Column({
    type: "varchar",
    length: 10,
    default: "INR",
  })
  currency!: string;

  @ManyToOne(() => User, (user) => user.accounts, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "userId" })
  user!: User;

  @CreateDateColumn()
  createdAt!: Date;
}